'use client';
import {useState, useEffect } from 'react';
import CalighterIcon from '/Calighter_icon_48x48.png'
import { AuthButton } from './authbutton'
import { isAuthenticated, terminateToken } from './oauth';
import { handleAddEvent } from './api';
import {TextField, Switch} from '@mui/material';
import * as chrono from 'chrono-node';
import { summarizerAPI } from './api';
import { loadNerPipeline, runModel } from './model'; 
export default function Popup() {
    //Allows for usage of null, true, and false because typescript naturally does not allow for assignment of null
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [input, setInput] = useState<boolean>(false)
    const [nerPipelineLoaded, setNerPipelineLoaded] = useState<boolean>(false);
    const [eventTitle, setEventTitle] = useState<string>("");
    const [start, setStart] = useState<string>("");
    const [end, setEnd] = useState<string>(""); 
    const [location, setLocation] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [trash, setTrash] = useState<boolean>(false);

    useEffect(() => {
        isAuthenticated().then(setAuthed);
    }, []);

    useEffect(() => {
        if (authed) {
            // Load NER pipeline if authenticated and setNerPipeline to true
            loadNerPipeline().then(() => {
                console.log("NER pipeline loaded successfully");
                setNerPipelineLoaded(true);
            }).catch((error) => {
                console.error("Failed to load NER pipeline:", error);
            });
        }
    }, [authed]);

    useEffect(() => {
        let previousText = "";
        const interval = setInterval(() => {
            if (!input) return;
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]?.id) return;
                chrome.tabs.sendMessage(
                    tabs[0].id!,
                    { action: "getSelectedText" },
                    async (response) => {
                        if (chrome.runtime.lastError) {
                            return;
                        }
                        if (response && response.selectedText && response.selectedText !== previousText) {
                            previousText = response.selectedText;
                            const parsedDate = chrono.parse(response.selectedText);
                            console.log("Parsed Date:", parsedDate);
                            if (parsedDate && parsedDate.length > 0) {
                                const {start: chronoStart, end: chronoEnd} = parsedDate[0];
                                setStart(chronoStart ? chronoStart.date().toLocaleString() : "");
                                setEnd(chronoEnd ? chronoEnd.date().toLocaleString() : "");
                            }
                            try {
                                if (nerPipelineLoaded) {
                                    console.log("Running NER on:", response.selectedText);
                                    const results = await runModel(response.selectedText);
                                    console.log("NER results:", results);

                                    if (results && results.EVENT.length > 0) {
                                        console.log("Event detected:", results.EVENT[0]);
                                        setEventTitle(results.EVENT.map(e => e.text).join(" "));
                                    }
                                    if (results && results.LOCATION.length > 0) {
                                        console.log("Location detected:", results.LOCATION[0]);
                                        setLocation(results.LOCATION.map(e => e.text).join(" "));
                                    }
                                }
                            } catch (error) {
                                console.error("Error running NER model:", error);
                            }

                            try {
                                const result = await summarizerAPI(response.selectedText);
                                setDescription(result || "");
                            } catch (error) {
                                setDescription("Summarization failed.");
                                console.error("Summarization failed:", error);
                            }
                        }
                    }
                );
            });
        }, 200);

        return () => clearInterval(interval);
    }, [input]);

    if (authed === null) {
        return (
            <div className="w-full min-h-screen bg-white flex items-center justify-center">
                <p className="text-black">Loading...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-white flex flex-col items-center justify-center pt-8 gap-2 px-4">
            <div className="flex items-center gap-2">
                <img className="w-12 h-12" src={CalighterIcon} alt="Calighter Icon"/>
                <h1 className="text-black text-5xl font-normal font-['VT323']">Calighter</h1>
            </div>
            <div className='flex-1 flex items-center justify-center'>
            {/* If the user is not authenticated, show the AuthButton */}
                {!authed && (
                    <AuthButton onAuthSuccess={() => setAuthed(true)} />
                )}

            {/* If the user is authenticated, show text boxes*/}
                {authed && (
                    <div>
                        <div className='mb-6 flex flex-col items-start gap-2 w-2/3 bg-gray-300 p-4 rounded mx-auto'>
                            <label className='text-lg'>
                                Dark Mode
                                <input type="checkbox" className="ml-4 w-6 h-6" />
                            </label>
                            <button className="bg-transparent hover:text-red-600 text-lg" onClick={async () => {
                                await terminateToken();
                                setAuthed(false);
                            }}>Sign Out
                            </button>
                            <button className='bg-transparent hover:text-red-600 text-lg'>
                                Switch Accounts
                            </button>

                        </div>
                        <div className="mb-4 flex items-center justify-center gap-2 w-full">
                            <p className="text-black text-2xl font-normal font-['VT323']">Enable Highlight Input</p> 
                            <Switch checked={input} onChange={(e) => setInput(e.target.checked)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-basic" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} placeholder='Event Title' value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-basic" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} placeholder='Start Time' value={start} onChange={(e) => setStart(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-basic" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} placeholder='End Time' value={end} onChange={(e) => setEnd(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-multiline-flexible" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} label="" placeholder='Location' value={location} onChange={(e) => setLocation(e.target.value)} multiline maxRows={3} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-multiline-flexible" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} label="" placeholder='Description' value={description} onChange={(e) => setDescription(e.target.value)} multiline maxRows={5} />
                        </div>
                        <div className="mb-8 mt-8 flex justify-center gap-4 w-full">
                            <button onClick={handleAddEvent} className="text-black text-2xl font-normal font-['VT323'] outline outline-2 px-4 py-2 rounded" style={{ outlineColor: '#07BCFA' }}>
                                Add to Calendar
                            </button>
                            <button onMouseEnter={() => setTrash(true)} onMouseLeave={() => setTrash(false)} onClick={() => { setEventTitle(""); setStart(""); setEnd(""); setLocation(""); setDescription(""); }} className="bg-transparent hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center p-2 rounded-full">
                                <img src={trash ? "/open_trash.png" : "/closed_trash.png"} alt="Trash" className="w-9 h-9" />
                            </button>     
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}