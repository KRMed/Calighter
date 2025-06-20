// This function is called when the user clicks the "Sign in with Google" button
export function OAuth() {
        chrome.identity.getAuthToken({ interactive: true}, function(token) {
            //Needs stuff
        }
    );
}