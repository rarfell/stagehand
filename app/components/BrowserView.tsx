import { IconFishBoneFilled, IconMeteorFilled } from '@tabler/icons-react';
import { SpaceInvadersIcon, RotateCwIcon } from 'raster-react';

interface BrowserViewProps {
  debugUrl: string | null;
  onTerminate: () => void;
  onReturnToStart: () => void;
  screenshot: string | null;
  isTerminated: boolean;
  isLoading: boolean;
  currentUrl: string | null;
}

export default function BrowserView({
  debugUrl,
  onTerminate,
  onReturnToStart,
  screenshot,
  isTerminated,
  isLoading,
  currentUrl
}: BrowserViewProps) {
  const screenshotUrl = screenshot ? `data:image/jpeg;base64,${screenshot}` : null;

  // Height ratios
  const NAV_HEIGHT = '40px'; // About 10% of 400px
  const STATUS_HEIGHT = '24px';
  const SCROLLBAR_WIDTH = '18px';

  return (
    <div
      className="relative font-steps-mono bg-[#e0e0e0]"
      style={{
        width: 600,
        height: 400,
        borderTop: '2px solid #fff',
        borderLeft: '2px solid #fff',
        borderBottom: '2px solid #888',
        borderRight: '2px solid #888',
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-between select-none"
        style={{
          height: '24px',
          background: 'linear-gradient(90deg, #2171c1 80%, #b0c8e8 100%)',
          // borderBottom: '0.5px solid #222',
          padding: '0 4px',
        }}
      >
        <div className="flex-1" />
        <div className="flex gap-0.5">
          {/* Minimize */}
          <button
            className="w-4 h-4 bg-[#e0e0e0] flex items-center justify-center p-0"
            style={{
              borderTop: '2px solid #fff',
              borderLeft: '2px solid #fff',
              borderBottom: '2px solid #888',
              borderRight: '2px solid #888',
              boxShadow: '1px 1px 0 #aaa',
              borderRadius: 0,
              marginRight: 1,
            }}
            aria-label="Minimize"
          >
            <span className="block w-3 h-0.5 bg-black" />
          </button>
          {/* Maximize */}
          <button
            className="w-4 h-4 bg-[#e0e0e0] flex items-center justify-center p-0"
            style={{
              borderTop: '2px solid #fff',
              borderLeft: '2px solid #fff',
              borderBottom: '2px solid #888',
              borderRight: '2px solid #888',
              boxShadow: '1px 1px 0 #aaa',
              borderRadius: 0,
              marginRight: 1,
            }}
            aria-label="Maximize"
          >
            <span className="block w-3 h-3 border-2 border-black" style={{ boxSizing: 'border-box' }} />
          </button>
          {/* Close */}
          <button
            className="w-4 h-4 bg-[#e0e0e0] flex items-center justify-center p-0"
            style={{
              borderTop: '2px solid #fff',
              borderLeft: '2px solid #fff',
              borderBottom: '2px solid #888',
              borderRight: '2px solid #888',
              boxShadow: '1px 1px 0 #aaa',
              borderRadius: 0,
              position: 'relative',
            }}
            aria-label="Close"
          >
            <span className="block w-3 h-0.5 bg-black absolute" style={{ transform: 'rotate(45deg)' }} />
            <span className="block w-3 h-0.5 bg-black absolute" style={{ transform: 'rotate(-45deg)' }} />
          </button>
        </div>
      </div>
      {/* Main Content Area with fake scrollbar */}
      <div
        className="relative flex-1 flex bg-white"
        style={{
          borderTop: '2px solid #000',
          borderLeft: '2px solid #000',
          borderBottom: '2px solid #fff',
          borderRight: '2px solid #fff',
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {/* Iframe + Overlayed Navigation Bar */}
        <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
          {/* Overlayed Navigation Bar */}
          <div
            className="flex items-center gap-1"
            style={{
              height: NAV_HEIGHT,
              background: '#f0f0f0',
              borderBottom: '2px solid #888',
              borderTop: '2px solid #fff',
              padding: '0 6px',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
            }}
          >
            {/* Back */}
            <button
              className="w-6 h-6 bg-[#e0e0e0] flex items-center justify-center p-0"
              style={{
                borderTop: '2px solid #fff',
                borderLeft: '2px solid #fff',
                borderBottom: '2px solid #888',
                borderRight: '2px solid #888',
                boxShadow: '1px 1px 0 #aaa',
                borderRadius: 0,
              }}
              aria-label="Back"
            >
              <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="8,2 4,6 8,10" fill="none" stroke="black" strokeWidth="1.5"/></svg>
            </button>
            {/* Forward */}
            <button
              className="w-6 h-6 bg-[#e0e0e0] flex items-center justify-center p-0"
              style={{
                borderTop: '2px solid #fff',
                borderLeft: '2px solid #fff',
                borderBottom: '2px solid #888',
                borderRight: '2px solid #888',
                boxShadow: '1px 1px 0 #aaa',
                borderRadius: 0,
              }}
              aria-label="Forward"
            >
              <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="4,2 8,6 4,10" fill="none" stroke="black" strokeWidth="1.5"/></svg>
            </button>
            {/* Home */}
            <button
              className="w-6 h-6 bg-[#e0e0e0] flex items-center justify-center p-0"
              style={{
                borderTop: '2px solid #fff',
                borderLeft: '2px solid #fff',
                borderBottom: '2px solid #888',
                borderRight: '2px solid #888',
                boxShadow: '1px 1px 0 #aaa',
                borderRadius: 0,
              }}
              aria-label="Home"
            >
              <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,2 2,6 3,6 3,10 5,10 5,8 7,8 7,10 9,10 9,6 10,6" fill="none" stroke="black" strokeWidth="1.5"/></svg>
            </button>
            {/* Refresh */}
            <button
              className="w-6 h-6 bg-[#e0e0e0] flex items-center justify-center p-0"
              style={{
                borderTop: '2px solid #fff',
                borderLeft: '2px solid #fff',
                borderBottom: '2px solid #888',
                borderRight: '2px solid #888',
                boxShadow: '1px 1px 0 #aaa',
                borderRadius: 0,
              }}
              aria-label="Refresh"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path
                  d="M10 2.5C9 1.5 7.5 1 6 1C3.5 1 1.5 3 1.5 5.5C1.5 8 3.5 10 6 10C8 10 9.5 8.5 10 7"
                  fill="none"
                  stroke="black"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 2.5L10 5.5L7 2.5"
                  fill="none"
                  stroke="black"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            {/* URL Bar */}
            <input
              type="text"
              value={currentUrl || ''}
              readOnly
              className="flex-1 mx-2 px-2 py-1 h-6 bg-white text-xs font-steps-mono outline-none"
              style={{
                borderTop: '2px solid #888',
                borderLeft: '2px solid #888',
                borderBottom: '2px solid #fff',
                borderRight: '2px solid #fff',
                boxShadow: 'inset 2px 2px 4px #aaa',
                borderRadius: 0,
                minWidth: 0,
              }}
            />
          </div>
          {/* Iframe preview, shifted up so nav bar overlays it */}
          {debugUrl ? (
            <iframe
              src={debugUrl}
              className="w-full h-full bg-white border-none"
              allow="fullscreen"
              style={{ borderRadius: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold font-steps-mono">No Page Loaded</div>
          )}
        </div>
        {/* Fake Scrollbar with arrows and sharp thumb */}
        <div
          className="flex flex-col items-center"
          style={{
            width: SCROLLBAR_WIDTH,
            height: '100%',
            background: '#e0e0e0',
            borderLeft: '2px solid #fff',
            borderRight: '2px solid #888',
            boxShadow: 'inset 1px 0 0 #aaa',
            position: 'relative',
            zIndex: 3,
          }}
        >
          {/* Up Arrow */}
          <button
            style={{
              width: '100%',
              height: 18,
              background: '#f8f8f8',
              borderTop: '2px solid #fff',
              borderBottom: '2px solid #888',
              borderLeft: 'none',
              borderRight: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              margin: 0,
              boxShadow: 'none',
              borderRadius: 0,
            }}
            tabIndex={-1}
            aria-label="Scroll Up"
            disabled
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,7 5,3 8,7" fill="none" stroke="black" strokeWidth="1.5"/></svg>
          </button>
          <div style={{ flex: 1 }} />
          {/* Scrollbar Thumb */}
          <div
            style={{
              width: '80%',
              height: 40,
              background: 'linear-gradient(90deg, #fff 60%, #ccc 100%)',
              border: '2px solid #888',
              borderRadius: 0, // sharp corners
              margin: '8px 0',
              boxShadow: 'inset 1px 1px 0 #fff',
            }}
          />
          <div style={{ flex: 1 }} />
          {/* Down Arrow */}
          <button
            style={{
              width: '100%',
              height: 18,
              background: '#f8f8f8',
              borderBottom: '2px solid #888',
              borderTop: '2px solid #fff',
              borderLeft: 'none',
              borderRight: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              margin: 0,
              boxShadow: 'none',
              borderRadius: 0,
            }}
            tabIndex={-1}
            aria-label="Scroll Down"
            disabled
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,3 5,7 8,3" fill="none" stroke="black" strokeWidth="1.5"/></svg>
          </button>
        </div>
        {/* Terminate/Return Button (floating) */}
        <button
          onClick={isTerminated ? onReturnToStart : onTerminate}
          className={`absolute bottom-4 right-8 flex items-center justify-center p-0 text-black font-steps-mono`}
          style={{
            width: 45,
            height: 45,
            borderTop: '2px solid #fff',
            borderLeft: '2px solid #fff',
            borderBottom: '2px solid #888',
            borderRight: '2px solid #888',
            boxShadow: '1px 1px 0 #aaa',
            borderRadius: 0,
            background: '#e0e0e0',
            zIndex: 10,
          }}
          aria-label={isTerminated ? "Return to Start" : "Terminate Session"}
        >
          {isTerminated ? (
            <RotateCwIcon className="w-6 h-6" />
          ) : (
            <SpaceInvadersIcon className="w-6 h-6" />
          )}
        </button>
      </div>
      {/* Status Bar */}
      <div
        className="flex items-center px-2"
        style={{
          height: STATUS_HEIGHT,
          background: '#e0e0e0',
          borderTop: '2px solid #fff',
          borderBottom: '2px solid #888',
          borderLeft: '2px solid #fff',
          borderRight: '2px solid #888',
          fontSize: 12,
          color: '#888',
          boxShadow: 'inset 0 2px 0 #fff',
        }}
      >

      </div>
    </div>
  );
} 