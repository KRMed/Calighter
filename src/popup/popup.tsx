'use client';
import {useState, useEffect } from 'react';
import CalighterIcon from '/Calighter_icon_48x48.png'
import { AuthButton } from './authbutton'
import { DateTimeMask, formatMaskedLocal } from "./timemask"
import { isAuthenticated, terminateToken } from './oauth';
import { handleAddEvent, getCalendars } from './api';
import {TextField, Switch} from '@mui/material';
import "nes.css/css/nes.min.css";
import { motion, AnimatePresence } from "framer-motion";
import * as chrono from 'chrono-node';
// import { summarizerAPI } from './api';
import { loadNerPipeline, runModel } from './model'; 

export default function Popup() {
    //Allows for usage of null, true, and false because typescript naturally does not allow for assignment of null
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [input, setInput] = useState<boolean>(false)
    const [nerPipelineLoaded, setNerPipelineLoaded] = useState<boolean>(false);
    const [calendarList, setCalendarList] = useState<{ id: string; summary: string }[] | null>(null);
    const [selectedCalendar, setSelectedCalendar] = useState<string>("");
    const [eventTitle, setEventTitle] = useState<string>("");
    const [start, setStart] = useState<string>("");
    const [end, setEnd] = useState<string>(""); 
    const [showOptions, setShowOptions] = useState<boolean>(false);
    const [location, setLocation] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [trash, setTrash] = useState<boolean>(false);

    useEffect(() => {
        isAuthenticated().then(setAuthed);
    }, []);

    // On authentication change
    useEffect(() => {
        if (authed) {
            // Load NER pipeline if authenticated and setNerPipeline to true
            loadNerPipeline().then(() => {
                console.log("NER pipeline loaded successfully");
                setNerPipelineLoaded(true);
            }).catch((error) => {
                console.error("Failed to load NER pipeline:", error);
            });

            // Fetch calendars as well
            const fetchCalendars = async () => {
            const calendars = await getCalendars();
            if (calendars) {
                console.log("Fetched calendars:", calendars);
                setCalendarList(calendars);
                if (calendars && calendars.length) {
                    setSelectedCalendar((prev) => prev || calendars[0].id);
                }
            }
        };

        fetchCalendars();
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
                                setStart(chronoStart ? formatMaskedLocal(chronoStart.date()) : "");
                                setEnd(chronoEnd ? formatMaskedLocal(chronoEnd.date()) : "");
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
                        <div className='mb-6 flex flex-col gap-3 justify-center items-center w-full'>
                            <button type="button" className="nes-btn is-primary font-[VT323] w-full" onClick={() => setShowOptions(!showOptions)}>Settings</button>
                            <AnimatePresence>
                                {showOptions && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden w-full space-y-1"
                                    >
                                        <label className="text-black text-2xl font-normal font-['VT323'] flex items-center justify-between mb-0 w-full">
                                            Dark Mode
                                            <input type="checkbox" className="w-6 h-6" />
                                        </label>
                                        <p className="text-black text-2xl font-normal font-['VT323'] mb-0">Switch Calendar</p>
                                        <label>
                                            <select className="w-full p-2 border rounded" value={selectedCalendar} onChange={(e) => setSelectedCalendar(e.target.value)}>
                                                {calendarList?.map((calendar) => (
                                                    <option key={calendar.id} value={calendar.id}>
                                                        {calendar.summary}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <button type="button" className='nes-btn is-error font-[VT323] w-full' onClick={async () => {
                                await terminateToken();
                                setAuthed(false);
                                setEventTitle("");
                                setStart("");
                                setEnd("");
                                setLocation("");
                                setDescription("");
                            }}>Logout</button>
                        </div>
                        <div className="mb-4 flex items-center justify-center gap-2 w-full">
                            <p className="text-black text-2xl font-normal font-['VT323']">Enable Highlight Input</p> 
                            <Switch checked={input} onChange={(e) => setInput(e.target.checked)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-basic" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} placeholder='Event Title' value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField
                                id="outlined-basic"
                                name="start"
                                variant="outlined"
                                fullWidth
                                size="small"
                                sx={{
                                    "& .MuiOutlinedInput-input": { fontSize: "17px !important" },
                                    "& .MuiInputBase-input": { fontSize: "17px !important" }, // fallback
                                }}
                                placeholder="Start Time"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                slotProps={{
                                    input: {
                                        inputComponent: DateTimeMask as any,
                                        name: "start",
                                    },
                                }}
                            />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField
                                id="outlined-basic"
                                name="end"
                                variant="outlined"
                                fullWidth
                                size="small"
                                sx={{
                                    "& .MuiOutlinedInput-input": { fontSize: "17px !important" },
                                    "& .MuiInputBase-input": { fontSize: "17px !important" }, // fallback
                                }}
                                placeholder=" Time"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                slotProps={{
                                    input: {
                                        inputComponent: DateTimeMask as any,
                                        name: "end",
                                    },
                                }}
                            />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-multiline-flexible" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} label="" placeholder='Location' value={location} onChange={(e) => setLocation(e.target.value)} multiline maxRows={3} />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <TextField id="outlined-multiline-flexible" fullWidth size="small" sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }} label="" placeholder='Description' value={description} onChange={(e) => setDescription(e.target.value)} multiline maxRows={5} />
                        </div>
                        <div className="mb-8 mt-8 flex justify-center gap-4 w-full">
                            <button onClick={ async() => handleAddEvent({
                                title: eventTitle, // pulled from your state
                                location: location,
                                startTime: { dateTime: start },
                                endTime: { dateTime: end },
                                description: description,
                                calendarId: selectedCalendar || (calendarList && calendarList.length > 0 ? calendarList[0].id : ""),
                            }
                            )} className="text-black text-2xl font-normal font-['VT323'] outline outline-2 px-4 py-2 rounded" style={{ outlineColor: '#07BCFA' }}>
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