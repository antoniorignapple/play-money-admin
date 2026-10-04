import { useEffect } from 'react';

const LOGO_SRC = '/app-icon.png';

export function SplashLogo({ loginDestination = false, appDestination = false }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const previous = {
      htmlBackground: html.style.background,
      bodyBackground: body.style.background,
      bodyOverflow: body.style.overflow,
      rootBackground: root?.style.background,
    };

    html.style.background = '#000';
    body.style.background = '#000';
    body.style.overflow = 'hidden';
    if (root) root.style.background = '#000';

    return () => {
      html.style.background = previous.htmlBackground;
      body.style.background = previous.bodyBackground;
      body.style.overflow = previous.bodyOverflow;
      if (root) root.style.background = previous.rootBackground;
    };
  }, []);

  const destinationClass = loginDestination
    ? 'pm-splash-login-destination'
    : appDestination
      ? 'pm-splash-app-destination'
      : 'pm-splash-waiting';

  return (
    <div className={`pm-simple-splash fixed inset-0 z-[9999] overflow-hidden bg-black ${destinationClass}`}>
      <img
        src={LOGO_SRC}
        alt="Play Money Admin"
        draggable="false"
        className="pm-simple-splash-logo absolute select-none object-contain"
      />
      <div className="pm-splash-copy absolute inset-x-0 text-center">
        <p className="text-[11px] font-bold text-white/45">Preparazione giornata</p>
        <span className="pm-splash-loader mx-auto mt-3 block h-1 w-16 overflow-hidden rounded-full bg-white/10"><i className="block h-full rounded-full bg-[#3e94c9]"/></span>
      </div>

      <style>{`
        .pm-simple-splash{
          --pm-brand-width:min(56vw,230px);
          --pm-brand-half:115px;
          --pm-splash-scale:1;
          --pm-splash-logo-half:var(--pm-brand-half);
          --pm-brand-top:max(calc(env(safe-area-inset-top) + 18px),clamp(34px,7vh,70px));
          width:100vw;height:100dvh;min-height:100svh;max-height:100dvh;
          isolation:isolate;overscroll-behavior:none
        }
        .pm-simple-splash-logo{
          left:50%;top:var(--pm-brand-top);width:var(--pm-brand-width);aspect-ratio:1;
          transform-origin:50% 50%;will-change:transform
        }
        .pm-splash-copy{top:calc(50dvh + var(--pm-splash-logo-half) + 18px);animation:pmSplashCopyIn .5s ease .18s both}
        .pm-splash-loader i{width:45%;animation:pmSplashLoad 1.05s ease-in-out infinite}
        .pm-splash-login-destination .pm-splash-copy,.pm-splash-app-destination .pm-splash-copy{animation:pmSplashCopyOut .35s ease both}
        .pm-splash-waiting .pm-simple-splash-logo{animation:pmSplashHeartbeat 1.15s ease-in-out infinite}
        .pm-splash-login-destination .pm-simple-splash-logo{animation:pmSplashToLogin 1.45s cubic-bezier(.2,.78,.2,1) both}
        .pm-splash-app-destination .pm-simple-splash-logo{animation:pmSplashOpenApp 1.25s cubic-bezier(.2,.8,.2,1) both}
        @keyframes pmSplashHeartbeat{
          0%,100%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          46%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          58%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(1.05)}
          70%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          78%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(1.025)}
        }
        @keyframes pmSplashToLogin{
          0%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          16%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(1.05)}
          30%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          100%{transform:translate3d(-50%,0,0) scale(1)}
        }
        @keyframes pmSplashOpenApp{
          0%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          35%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(1.08)}
          62%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(.96)}
          100%{transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
        }
        @keyframes pmSplashCopyIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes pmSplashCopyOut{to{opacity:0;transform:translateY(-6px)}}
        @keyframes pmSplashLoad{0%{transform:translateX(-110%)}100%{transform:translateX(245%)}}
        @media(max-width:374px){
          .pm-simple-splash{--pm-brand-width:205px;--pm-brand-half:102.5px;--pm-brand-top:max(calc(env(safe-area-inset-top) + 14px),28px)}
        }
        @media(max-height:720px){
          .pm-simple-splash{--pm-brand-width:190px;--pm-brand-half:95px;--pm-brand-top:max(calc(env(safe-area-inset-top) + 8px),14px)}
        }
        @media(prefers-reduced-motion:reduce){
          .pm-splash-waiting .pm-simple-splash-logo,.pm-splash-app-destination .pm-simple-splash-logo{animation:none;transform:translate3d(-50%,calc(50dvh - var(--pm-brand-top) - var(--pm-brand-half)),0) scale(var(--pm-splash-scale))}
          .pm-splash-login-destination .pm-simple-splash-logo{animation:pmSplashToLogin .45s ease both}
        }
      `}</style>
    </div>
  );
}

