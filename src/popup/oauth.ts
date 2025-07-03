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

// This function revokes the token when the user signs out
export async function terminateToken(): Promise<boolean> {
    return new Promise((resolve) => {
        // Attempt to get the auth token without prompting the user
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (chrome.runtime.lastError || !token) {
                resolve(false);
            } else {
                chrome.identity.removeCachedAuthToken({ token: token as string }, () => {
                    if (chrome.runtime.lastError) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
         });
            }
        });
    });
};