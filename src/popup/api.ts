import { getAccessToken, terminateToken } from "./oauth";

type EventPoint = { date: string } | { dateTime: string };

interface EventInput {
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;
  startTime: EventPoint;
  endTime?: EventPoint;
  description?: string;
  calendarId: string;
}

interface GoogleEventBody {
  summary: string;
  start: EventPoint;
  end: EventPoint;
  location?: string;
  description?: string;
}

function toRFC3339Local(input: string): string {
  const s = String(input).trim();

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+\-]\d{2}:\d{2})$/.test(s)
  ) {
    return s;
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");

  // 1) Try masked US style: "MM/DD/YY[YY][,] HH:MM[:SS] [AM|PM]" (time part optional)
  {
    // with optional comma and optional seconds + optional AM/PM
    const m = s.match(
      /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:,)?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?\s*$/i
    );
    if (m) {
      let [, M, D, Y, hh, mm, ss = "0", ap] = m;

      // Year normalize: 2-digit → pivot 69 (00–69 => 2000–2069, else 1900–1999)
      let year = parseInt(Y, 10);
      if (Y.length === 2) {
        year = year <= 69 ? 2000 + year : 1900 + year;
      }

      const month = Math.min(Math.max(parseInt(M, 10), 1), 12);
      const day = Math.min(Math.max(parseInt(D, 10), 1), 31);

      let H = 0, MIN = 0, SEC = 0;

      if (hh && mm) {
        H = parseInt(hh, 10);
        MIN = parseInt(mm, 10);
        SEC = parseInt(ss || "0", 10);

        if (ap) {
          // 12-hour with AM/PM if suffix present
          const isPM = /pm/i.test(ap);
          H = (H % 12) + (isPM ? 12 : 0);
        } else {
          // 24-hour if no suffix
          H = Math.min(Math.max(H, 0), 23);
        }
        MIN = Math.min(Math.max(MIN, 0), 59);
        SEC = Math.min(Math.max(SEC, 0), 59);
      }

      const d = new Date(year, month - 1, day, H, MIN, SEC, 0);

      // Format with local offset
      const offMin = -d.getTimezoneOffset(); // positive east
      const sign = offMin >= 0 ? "+" : "-";
      const oh = pad2(Math.floor(Math.abs(offMin) / 60));
      const om = pad2(Math.abs(offMin) % 60);

      return (
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
        `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${sign}${oh}:${om}`
      );
    }
  }
  
  {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const offMin = -d.getTimezoneOffset();
      const sign = offMin >= 0 ? "+" : "-";
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const oh = pad2(Math.floor(Math.abs(offMin) / 60));
      const om = pad2(Math.abs(offMin) % 60);
      return (
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
        `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${sign}${oh}:${om}`
      );
    }
  }

  throw new Error(`Unsupported date format: ${input}`);
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
  if (!event.startDate?.trim()) {
    console.error("Start date is required.");
    return;
  }
  if (!event.startTime) {
    console.error("Start time/date is required.");
    return;
  }

  const startTimeStr = "dateTime" in event.startTime ? event.startTime.dateTime.trim() : "";

  const endTimeStr =
    event.endTime && "dateTime" in event.endTime
      ? event.endTime.dateTime.trim()
      : "";

  if (!startTimeStr) {
    console.error("Start time is required.");
    return;
  }

  const startInputStr = `${event.startDate.trim()}, ${startTimeStr}`;
  const startISO = toRFC3339Local(startInputStr);


  let endISO: string;

  if (event.endDate?.trim() && endTimeStr) {
    // end date + end time
    const endInputStr = `${event.endDate.trim()}, ${endTimeStr}`;
    endISO = toRFC3339Local(endInputStr);
  } else if (endTimeStr) {
    // only end time -> same date as start
    const endInputStr = `${event.startDate.trim()}, ${endTimeStr}`;
    endISO = toRFC3339Local(endInputStr);
  } else if (event.endDate?.trim()) {
    // only end date -> reuse start clock time
    const endInputStr = `${event.endDate.trim()}, ${startTimeStr}`;
    endISO = toRFC3339Local(endInputStr);
  } else {
    // no end -> +60m
    const start = new Date(startISO);
    if (isNaN(start.getTime())) {
      console.error("Invalid start instant.");
      return;
    }
    endISO = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
  }

  if (new Date(endISO) <= new Date(startISO)) {
    endISO = new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
  }

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
            console.error('Failed parsing error JSON', e);
          }
          console.error("Failed to add event:", response.status, errorData);
          return;
      }
  } catch (error) {
      console.error("An error occurred while adding the event:", error);
  }
}