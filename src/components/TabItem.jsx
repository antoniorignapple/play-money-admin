
export const TabItem = ({ icon: Icon, id, label, activeTab, setActiveTab, badge = 0 }) => {
  const isActive = activeTab === id;
  const badgeValue = Number(badge) || 0;

  return (
    <button
      data-tabbtn="1"
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      type="button"
      onClick={() => setActiveTab(id)}
      className="
        relative flex-1 h-full
        flex flex-col items-center justify-center gap-1
        transition-all duration-200
        active:scale-[0.96]
      "
    >
      <span
        className={`pm-tab-ico ${isActive ? "pm-tab-ico-active" : "pm-tab-ico-idle"}`}
        style={isActive ? { "--pm-ico-glow": "rgba(10,61,92,.28)" } : undefined}
      >
        <Icon
          size={24}
          strokeWidth={isActive ? 2.8 : 2.4}
          className={isActive ? "text-[#f1f9fe]" : "text-[#5d6c76]"}
        />

        {badgeValue > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/80 bg-rose-500 px-1 text-[10px] font-black leading-none text-white shadow-[0_8px_18px_-8px_rgba(244,63,94,1)]">
            {badgeValue > 9 ? '9+' : badgeValue}
          </span>
        )}
      </span>

      <span
        className={`
          text-[11px] leading-none tracking-[0.09em] font-black
          transition-colors duration-200
          ${isActive ? "text-[#f1f9fe]" : "text-[#5d6c76]"}
        `}
      >
        {label}
      </span>
    </button>
  );
};

