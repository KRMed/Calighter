'use client';
import {useState, useEffect } from 'react';
import CalighterIcon from '/Calighter_icon_48x48.png'
import { AuthButton } from './authbutton'
import { isAuthenticated, terminateToken } from './oauth';
import { handleAddEvent } from './api';

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
        <div className="w-full min-h-screen bg-white flex flex-col items-center justify-center pt-8 gap-2">
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
                        <button onClick={handleAddEvent}>AddEvent</button>
                        <p className='text-black'>placeholder</p>
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