interface BrowserViewProps {
  debugUrl: string | null;
  isSessionTerminated: boolean;
  onTerminate: () => void;
  onRefresh: () => void;
  screenshot: string | null;
}

export default function BrowserView({ 
  debugUrl, 
  isSessionTerminated, 
  onTerminate, 
  onRefresh,
  screenshot 
}: BrowserViewProps) {
  console.log('BrowserView props:', { 
    isSessionTerminated, 
    hasScreenshot: !!screenshot, 
    screenshotLength: screenshot?.length,
    screenshotPrefix: screenshot?.substring(0, 20) // Log first 20 chars to check format
  });

  const screenshotUrl = screenshot ? `data:image/jpeg;base64,${screenshot}` : null;

  return (
    <div className="relative w-[min(1280px,80vw)] h-[min(720px,45vw)] rounded-2xl overflow-hidden border-[3px] border-[#404040]">
      {isSessionTerminated && screenshot ? (
        <div className="w-full h-full relative">
          {screenshotUrl && (
            <img 
              src={screenshotUrl}
              alt="Session Screenshot" 
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Error loading screenshot:', e);
                console.log('Screenshot URL:', screenshotUrl?.substring(0, 100));
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-md font-bold bg-gray-300/35 px-3 py-1 rounded-xl">
              Session Terminated
            </div>
          </div>
        </div>
      ) : debugUrl ? (
        <iframe
          src={debugUrl}
          className="w-full h-full"
          allow="fullscreen"
        />
      ) : null}
      <button
        onClick={isSessionTerminated ? onRefresh : onTerminate}
        className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg transition-colors duration-200 ${
          isSessionTerminated 
            ? 'bg-green-500 hover:bg-green-600' 
            : 'bg-red-500 hover:bg-red-600'
        } text-white`}
        aria-label={isSessionTerminated ? "Refresh" : "Terminate Session"}
      >
        {isSessionTerminated ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
      </button>
    </div>
  );
} 