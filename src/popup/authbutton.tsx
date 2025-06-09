"use client";
import GCal from "/Google_Calendar_icon_(2020).svg.png"

export default function AuthButton(){
    return(
        //Visual display
        <div>
            <button className="hover:drop-shadow-md hover:bg-gray-100 transition-colors duration-200 justify-center items-center flex gap-2 bg-white border-2 rounded-full p-4 w-full max-w-md">
                <img className="w-9 h-9" src={GCal} alt="Google Calendar Icon"/>
                <h2 className="text-black font-medium">Sign in with Google</h2>
            </button>

        </div>



        //Nitty gritty
    )
}