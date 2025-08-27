// This function is called when the user clicks the "Sign in with Google" button
export async function OAuth(): Promise<null | string> {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: true }, function(token) {
            if (chrome.runtime.lastError || !token) {
                resolve(null);
            } else {
                resolve(token as string);
            }
        });
    });
}

// Used to check if user is already signed in
export async function isAuthenticated(): Promise<boolean> {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (chrome.runtime.lastError || !token) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

// Gets access token
export async function getAccessToken(): Promise<string | null> {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (chrome.runtime.lastError || !token) {
                resolve(null);
            } else {
                resolve(token as string);
            }
        });
    });
}

// Used to clear token google server side
async function revokeGoogleToken(token: string): Promise<void> {
    try {
        await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `token=${encodeURIComponent(token)}`
        });
    } catch {
        console.error("Failed to revoke token at google level");
    }
}

// Helper function used to clear cached token
async function removeCachedAuthToken(token: string): Promise<void> {
    return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
            if (chrome.runtime.lastError) {
                console.error("Failed to remove cached auth token");
            }
            resolve();
        });
    });
}

// Helper function used to clear all cached tokens
async function clearAllCachedAuthTokens(): Promise<void> {
    return new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
            if (chrome.runtime.lastError) {
                console.error("Failed to clear all cached auth tokens");
            }
            resolve();
        });
    });
}

// This function revokes the token when the user signs out
export async function terminateToken(): Promise<boolean> {
    // Attempt to get the auth token without prompting the user
    const token = await getAccessToken();
    if (!token) {
        return true;
    }

    await revokeGoogleToken(token as string);
    await removeCachedAuthToken(token as string);
    await clearAllCachedAuthTokens();

    return true;
}

