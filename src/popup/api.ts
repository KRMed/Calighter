export async function handleAddEvent() {
    console.log("Add event button clicked");
}

declare const Summarizer: any;

export async function summarizerAPI(highlightedText: string): Promise<string | null> {
    if ('Summarizer' in self){

        const available = await Summarizer.availability();
        if (available === 'unavailable') {
            console.error("Summarizer API is unavailable");
            return null;
        }

        const summarizer = await Summarizer.create({
            type: 'tldr',      // or 'tldr', 'teaser', 'headline'
            format: 'plain-text',      
            length: 'short',         
            sharedContext: "Summarize this for a Google Calendar event description",
            expectedInputLanguages: ["en-US"],
            outputLanguage: "en-US"
        });

        // Generate a summary for your text
        const summary = await summarizer.summarize(highlightedText);
        summarizer.destroy();
        return summary;
    }

    else {
        console.error("Summarizer API is not available in this context.");
        return null;
    }
}