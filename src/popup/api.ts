import { getAccessToken, terminateToken } from "./oauth";

interface EventInput {
  title: string;
  location?: string;
  startTime: { dateTime: string };
  endTime?: { dateTime: string };
  description?: string;
  calendarId: string;
}

interface GoogleEventBody {
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: string;
  description?: string;
}

function toRFC3339Local(input: string): string {
  let d = new Date(input);
  if (isNaN(d.getTime())) {
      const m = input.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
      if (!m) throw new Error(`Unsupported date format: ${input}`);
      const [, M, D, Y, h, min, s = "0", ampm] = m;
      const H = (parseInt(h, 10) % 12) + (/pm/i.test(ampm) ? 12 : 0);
      d = new Date(parseInt(Y, 10), parseInt(M, 10) - 1, parseInt(D, 10), H, parseInt(min, 10), parseInt(s, 10), 0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(offMin) / 60));
  const om = pad(Math.abs(offMin) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`;
}

async function postEvent(url: string, body: object, retries: number = 3, backoff: number = 500): Promise<Response> {
  const send = (token: string) =>
      fetch(url, {
          method: "POST",
          headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
  });

  let accessToken = await getAccessToken();

  if (!accessToken) {
      console.error("Failed to retrieve access token");
      return new Response(null, { status: 401 });
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
      let response = await send(accessToken);

      if (response.status === 401) {
          await terminateToken();
          accessToken = await getAccessToken();
          if (!accessToken) return response;
          response = await send(accessToken);
          if (response.ok) return response;
      }

      if (response.ok) {
          return response;
      }

      if ([429, 500, 502, 503].includes(response.status) && attempt < retries) {
          const delay = backoff * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, delay));
          continue;
      }

      return response;
    }

    console.error("Failed to post event after retries");
    return new Response(null, { status: 599, statusText: "Exhausted retries" });
}

export async function getCalendars(
  retries: number = 3,
  backoff: number = 500
): Promise<{ id: string; summary: string }[] | null> {
  const base = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
  const params = new URLSearchParams({
    maxResults: "250", 
    showHidden: "true",
  });

  const send = (token: string, pageToken?: string) => {
    const url = `${base}?${params.toString()}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    return fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };

  let accessToken = await getAccessToken();

  if (!accessToken) {
    console.error("Failed to retrieve access token");
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    let pageToken: string | undefined = undefined;
    const all: { id: string; summary: string }[] = [];

    while (true) {
      let response = await send(accessToken, pageToken);

      if (response.status === 401) {
        await terminateToken();
        accessToken = await getAccessToken();
        if (!accessToken) return null;
        response = await send(accessToken, pageToken);
      }

      if (!response.ok) {
        if ([429, 500, 502, 503].includes(response.status) && attempt < retries) {
          const delay = backoff * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
        console.error("Failed to fetch calendars:", response.status, await response.text());
        return null;
      }

      const data: unknown = await response.json();
      const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const rawItems = Array.isArray(obj.items) ? (obj.items as unknown[]) : [];
      const items = rawItems.map((raw) => {
        const item = raw as Record<string, unknown>;
        const id = typeof item.id === 'string' ? item.id : String(item.id ?? '');
        const summary = typeof item.summary === 'string' ? item.summary : String(item.summary ?? '');
        return { id, summary };
      });
      all.push(...items);

      const nextPageToken = typeof obj.nextPageToken === 'string' ? obj.nextPageToken : undefined;
      pageToken = nextPageToken;
      if (!pageToken) break;
    }

    return all;
  }

  console.error("Failed to fetch calendars after retries");
  return null;
}

export async function handleAddEvent(event: EventInput): Promise<void> {
    if (!event.title || !event.title.trim()) {
        console.error("Event title is required.");
        return;
    }
    if (!event.startTime?.dateTime) {
        console.error("Start and end time are required.");
        return;
    }

    let endInput: string;
    if (!event.endTime?.dateTime) {
        const startDate = new Date(event.startTime.dateTime);
        if (isNaN(startDate.getTime())) {
            console.error("Invalid start time format.");
            return;
        }
        startDate.setHours(startDate.getHours() + 1);
        endInput = startDate.toISOString(); // use ISO string for conversion
    } else {
        endInput = event.endTime.dateTime;
    }

    const startISO = toRFC3339Local(event.startTime.dateTime);
    const endISO   = toRFC3339Local(endInput);

    const body: GoogleEventBody = {
      summary: event.title.trim(),
      start: { dateTime: startISO },
      end: { dateTime: endISO },
    };
    if (event.location && event.location.trim().length > 0) body.location = event.location.trim();
    if (event.description && event.description.trim().length > 0) body.description = event.description.trim();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(event.calendarId)}/events`;

    try {
        const response = await postEvent(url, body);

        if (response.ok) {
            console.log("Event added");
            return;
        } else {
            let errorData: unknown = {};
            try {
              errorData = await response.json();
            } catch (e) {
              // response body is not JSON or could not be parsed
              console.debug('Failed parsing error JSON', e);
            }
            console.error("Failed to add event:", response.status, errorData);
            return;
        }
    } catch (error) {
        console.error("An error occurred while adding the event:", error);
    }
}