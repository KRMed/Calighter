'use client';
import CalighterIcon from '/Calighter_icon_48x48.png'
import AuthButton from './authbutton'

export default function Popup() {
    return (
        <div className="w-full min-h-screen bg-white flex flex-col items-center justify-center pt-8 gap-2">
            <div className="flex items-center gap-2">
                <img className="w-12 h-12" src={CalighterIcon} alt="Calighter Icon"/>
                <h1 className="text-black text-5xl font-normal font-['VT323']">Calighter</h1>
            </div>
            <div className='flex-1 flex items-center justify-center'>
                <AuthButton />
            </div>
        </div>
    )
}