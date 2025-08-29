// Replace your popup section with this enhanced version

{showPopup && (
  <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
    <div 
      className="bg-black/80 text-white px-8 py-6 rounded-2xl text-xl font-semibold shadow-2xl transform transition-all duration-300 ease-out"
      style={{
        animation: 'popupBounce 2s ease-out forwards',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" style={{ animation: 'celebrate 0.6s ease-in-out infinite alternate' }}>
          🎉
        </span>
        <span>Workout Saved!</span>
        <span className="text-2xl" style={{ animation: 'flex 0.8s ease-in-out infinite alternate' }}>
          💪
        </span>
      </div>
    </div>
    
    <style jsx>{`
      @keyframes popupBounce {
        0% {
          transform: scale(0.3) translateY(-50px);
          opacity: 0;
        }
        50% {
          transform: scale(1.1) translateY(0);
          opacity: 1;
        }
        70% {
          transform: scale(0.95);
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
      
      @keyframes celebrate {
        0% { transform: scale(1) rotate(-5deg); }
        100% { transform: scale(1.2) rotate(5deg); }
      }
      
      @keyframes flex {
        0% { transform: scale(1) rotate(-2deg); }
        100% { transform: scale(1.1) rotate(2deg); }
      }
    `}</style>
  </div>
)}

// Also consider extending the timeout duration in your saveSession function:
// setTimeout(() => setShowPopup(false), 3000); // 3 seconds instead of 2
