'use client';
import {useState, useEffect } from 'react';
import CalighterIcon from '/Calighter_icon_48x48.png'
import { AuthButton } from './authbutton'
import { isAuthenticated, terminateToken } from './oauth';
import { handleAddEvent } from './api';
import {Checkbox, FormControlLabel, TextField} from '@mui/material';
import Switch from '@mui/material/Switch';
import * as chrono from 'chrono-node';

export default function Popup() {
    //Allows for usage of null, true, and false because typescript naturally does not allow for assignment of null
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [input, setInput] = useState<boolean>(false)
    const [eventTitle, setEventTitle] = useState<string>("");
    const [start, setStart] = useState<string>("");
    const [end, setEnd] = useState<string>(""); 

    useEffect(() => {
        isAuthenticated().then(setAuthed);
    }, []);

    useEffect(() => {
        let previousText = "";
        const interval = setInterval(() => {
            if (!input) return;
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]?.id) return;
                chrome.tabs.sendMessage(
                    tabs[0].id!,
                    { action: "getSelectedText" },
                    (response) => {
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

                            setEventTitle(response.selectedText);
                        }
                    }
                );
            });
        }, 500);

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
                        <div className='mb-4 flex-col justify-center gap-2 w-1/2 bg-gray-300 p-4 rounded mx-auto'>
                            <div>
                                <button className="bg-transparent hover:text-red-600" onClick={async () => {
                                    await terminateToken();
                                    setAuthed(false);
                                    }}>Sign Out
                                </button>
                            </div>
                            <FormControlLabel
                                label="Dark Mode"
                                labelPlacement="start"
                                control={<Checkbox />}
                            />
                        </div>
                        <div className="mb-8 flex items-center justify-center gap-2 w-full">
                            <p className="text-black text-2xl font-normal font-['VT323']">Enable Highlight Input</p> 
                            <Switch checked={input} onChange={(e) => setInput(e.target.checked)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Title</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 }, '& .MuiFilledInput-input': { fontSize: 14 } }} id="filled-basic" label="" variant="filled" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Start</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 }, '& .MuiFilledInput-input': { fontSize: 14 } }} id="filled-basic" label="" variant="filled" value={start} onChange={(e) => setStart(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>End</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 }, '& .MuiFilledInput-input': { fontSize: 14 } }} id="filled-basic" label="" variant="filled" value={end} onChange={(e) => setEnd(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Location</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 }, '& .MuiFilledInput-input': { fontSize: 14 } }} id="filled-basic" label="" variant="filled" />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Description</p>
                            <TextField id="outlined-multiline-flexible" size="small" sx={{ width: '80%' }} label="" maxRows={5} />
                            {/* Figure out whats wrong with the multiline text field */}
                        </div>
                        <div className="mb-8 mt-5 flex justify-center gap-2 w-full">
                            <button onClick={handleAddEvent} className="text-black text-2xl font-normal font-['VT323'] outline outline-2 px-4 py-2 rounded" style={{ outlineColor: '#07BCFA' }}>
                                Add to Calendar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}