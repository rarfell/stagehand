import { IconFishBoneFilled } from '@tabler/icons-react';

interface BrowserViewProps {
  debugUrl: string | null;
  onTerminate: () => void;
  screenshot: string | null;
}

export default function BrowserView({ 
  debugUrl, 
  onTerminate, 
  screenshot 
}: BrowserViewProps) {

  const screenshotUrl = screenshot ? `data:image/jpeg;base64,${screenshot}` : null;

  return (
    <div className="relative w-[min(1280px,80vw)] h-[min(720px,45vw)] rounded-2xl overflow-hidden border-[3px] border-[#404040]">
      {debugUrl ? (
        <iframe
          src={debugUrl}
          className="w-full h-full"
          allow="fullscreen"
        />
      ) : null}
      <button
        onClick={onTerminate}
        className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg transition-colors duration-200 bg-red-500 hover:bg-red-60 text-white`}
        aria-label={"Terminate Session"}
      >
        <IconFishBoneFilled className="w-6 h-6" />
      </button>
    </div>
  );
} 