'use client';
import {useState, useEffect } from 'react';
import CalighterIcon from '/Calighter_icon_48x48.png'
import { AuthButton } from './authbutton'
import { isAuthenticated, terminateToken } from './oauth';
import { handleAddEvent } from './api';
import TextField from '@mui/material/TextField';

export default function Popup() {
    //Allows for usage of null, true, and false because typescript naturally does not allow for assignment of null
    const [authed, setAuthed] = useState<boolean | null>(null);

    useEffect(() => {
        isAuthenticated().then(setAuthed);
    }, []);

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
                    //When Nlp model is comlete text boxes should work for what we wanna do
                    <div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Title</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 } }} id="filled-basic" label="" variant="filled" />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Start</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 } }} id="filled-basic" label="" variant="filled" />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>End</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 }, '& .MuiFilledInput-input': { fontSize: 14 } }} id="filled-basic" label="" variant="filled" />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Location</p>
                            <TextField size="small" sx={{ width: '80%', height: 35, '& .MuiInputBase-root': { height: 35 } }} id="filled-basic" label="" variant="filled" />
                        </div>
                        <div className="mb-4 flex items-center gap-2 w-full">
                            <p className='font-bold min-w-[70px]'>Description</p>
                            <TextField id="outlined-multiline-flexible" size="small" sx={{ width: '80%' }} label="" maxRows={5} />
                            {/* Figure out whats wrong with the multiline text field */}
                        </div>
                        <button onClick={handleAddEvent} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
                            Add Event
                        </button>
                        <button onClick={async () => {
                            await terminateToken();
                            setAuthed(false);
                        }}>Sign Out</button>
                    </div>
                )}
            </div>
        </div>
    )
}