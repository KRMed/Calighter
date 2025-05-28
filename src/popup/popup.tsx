import CalighterIcon from '/Calighter_icon_48x48.png';

export default function Popup() {
    return (
        <div className="w-96 h-[468px] bg-white rounded-[10px] flex items-start justify-center pt-8 gap-2">
            <img className="w-12 h-12" src={CalighterIcon} alt="Calighter Icon"/>
            <h1 className="text-black text-5xl font-normal font-['VT323']">Calighter</h1>
        </div>
    )
}