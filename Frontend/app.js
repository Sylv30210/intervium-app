// L'API est servie par le même domaine en local comme en production.
const API_URL = "/api";

let currentUser = null;
let currentEntreprise = null;
let interventions = [];
let clients = [];
let equipements = [];
let technicians = [];
let creationClients = [];
let creationEquipements = [];
let reportTemplates = [];
let commercialDocuments = [];
let planningCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let templateDraftSections = [];
let currentView = "dashboard";
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let reportAutosaveTimer = null;
let reportAutosavePending = false;
let globalSearchTimer = null;
let mobileNavLongPressTimer = null;
let googleMailStatus = { enabled: false, connection: null };

const app = document.getElementById("app");
const THEME_STORAGE_KEY = "intervium_visual_theme";
const FUTURE_THEME_STORAGE_KEY = "noverys_visual_theme";
applyStoredTheme();

const styles = `
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f3f6fb;color:#182234}button,input,select,textarea{font:inherit;font-size:16px}button{cursor:pointer;min-height:44px;transition:all .2s ease-in-out}button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.03)}button:active:not(:disabled){transform:translateY(0) scale(.97)}button:disabled{cursor:wait;opacity:.72}.hidden{display:none!important}.brand-lockup{display:inline-flex;align-items:center;gap:10px;color:inherit;font-size:28px;font-weight:850;letter-spacing:-.7px}.brand-mark{width:34px;height:34px;flex:none;color:currentColor}.brand-lockup.auth-logo{color:#2563eb}.brand-lockup.compact{font-size:19px;gap:8px}.brand-lockup.compact .brand-mark{width:28px;height:28px}
.auth{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#eff6ff,#f8fafc)}.auth-card{width:min(460px,100%);background:white;border-radius:20px;padding:30px;box-shadow:0 20px 60px #1e3a5f20;animation:modal-in .3s ease-out}.tabs{display:flex;gap:8px;margin:22px 0}.tabs button{flex:1;border:0;border-radius:10px;padding:10px;background:#eaf0f8}.tabs button.active{background:#2563eb;color:white}.field{display:grid;gap:6px;margin:12px 0}.field label{font-size:13px;font-weight:700;color:#475569}.field input,.field select,.field textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px;background:white;transition:border-color .2s ease,box-shadow .2s ease}.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px #2563eb18}.primary,.danger,.secondary{border:0;border-radius:10px;padding:10px 14px;font-weight:700}.primary{background:#2563eb;color:white}.secondary{background:#e7eef8;color:#29415f}.danger{background:#fee2e2;color:#b91c1c}.wide{width:100%}.error{color:#b91c1c;background:#fef2f2;padding:10px;border-radius:8px;margin:10px 0}
.shell{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.sidebar{background:#10233f;color:white;padding:24px;display:flex;flex-direction:column;gap:24px}.sidebar .brand{color:white}.nav button{display:block;width:100%;text-align:left;background:transparent;color:#cbd5e1;border:0;padding:11px;border-radius:9px}.nav button.active,.nav button:hover{background:#ffffff18;color:white}.profile{margin-top:auto;font-size:13px;color:#cbd5e1}.mobile-header,.bottom-nav{display:none}.main{padding:28px;overflow:auto}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.topbar h1{margin:0}.muted{color:#64748b;font-size:13px}.stats{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:14px}.stat,.panel{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:18px}.stat strong{font-size:28px;display:block;margin-top:5px}.panel{margin-top:18px}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.panel h2{font-size:18px;margin:0}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:650px}th,td{text-align:left;padding:11px;border-bottom:1px solid #edf1f7;font-size:14px}th{color:#64748b;font-size:12px;text-transform:uppercase}.badge{display:inline-block;border-radius:999px;padding:5px 9px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700}.badge.off{background:#e2e8f0;color:#475569}.actions{display:flex;gap:7px;flex-wrap:wrap}.empty{text-align:center;color:#64748b;padding:28px}
.modal-backdrop{position:fixed;inset:0;background:#0f172a88;display:grid;place-items:center;padding:20px;z-index:20;animation:backdrop-in .22s ease-out}.modal{background:white;border-radius:16px;padding:22px;width:min(680px,100%);max-height:92dvh;overflow:auto;animation:modal-in .24s ease-out}.modal-head{display:flex;justify-content:space-between;align-items:center;position:sticky;top:-22px;background:white;z-index:2;padding:10px 0}.modal-head h2{margin:0}.close{border:0;background:transparent;font-size:28px;min-width:48px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.canvas{display:block;width:100%;height:180px;max-width:100%;border:2px dashed #94a3b8;border-radius:12px;touch-action:none;background:white}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.media-item{position:relative;min-width:0;transition:transform .2s ease,box-shadow .2s ease}.media-item:hover{transform:translateY(-2px)}.media-item img{display:block;width:100%;height:130px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;background:white}.media-item.signature img{object-fit:contain}.media-pdf-choice{display:flex;align-items:center;gap:7px;margin-top:7px;font-size:12px;font-weight:700;color:#334155}.media-delete{position:absolute;top:7px;right:7px;min-height:40px;min-width:40px;border:0;border-radius:999px;background:#dc2626;color:white;font-size:18px;box-shadow:0 3px 10px #0004}.toast{position:fixed;right:20px;bottom:20px;max-width:min(420px,calc(100vw - 32px));background:#172554;color:white;padding:12px 16px;border-radius:10px;z-index:50;animation:toast-in .24s ease-out}.toast.bad{background:#991b1b}#view{animation:view-in .24s ease-out}.spinner{display:inline-block;width:18px;height:18px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-3px}.spinner.large{width:30px;height:30px;border-width:3px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.app-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#eff6ff,#f8fafc)}.loading-card{width:min(360px,calc(100% - 32px));display:grid;justify-items:center;gap:18px;background:white;padding:28px;border-radius:20px;box-shadow:0 18px 55px #1e3a5f1c}.skeletons{width:100%;display:grid;gap:9px}.skeleton{height:12px;border-radius:99px;background:linear-gradient(90deg,#e8eef6 25%,#f8fafc 50%,#e8eef6 75%);background-size:200% 100%;animation:shimmer 1.2s ease-in-out infinite}.skeleton:nth-child(2){width:78%}.skeleton:nth-child(3){width:58%}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{to{background-position:-200% 0}}@keyframes view-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes backdrop-in{from{opacity:0}to{opacity:1}}@keyframes modal-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@keyframes drawer-up{from{transform:translateY(100%);opacity:.4}to{transform:translateY(0);opacity:1}}@keyframes toast-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media(max-width:768px){body{background:#f7f9fc}.shell{display:block;min-height:100dvh}.sidebar{display:none}.mobile-header{display:flex;position:fixed;inset:0 0 auto 0;height:54px;padding:0 14px;align-items:center;justify-content:space-between;background:#10233f;color:white;z-index:15;box-shadow:0 2px 12px #0f172a24}.mobile-brand{font-size:19px;font-weight:850;letter-spacing:-.3px}.mobile-user{display:flex;align-items:center;gap:9px;min-width:0}.mobile-user-name{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#dbeafe}.mobile-logout{border:1px solid #ffffff30;background:#ffffff12;color:white;border-radius:999px;width:40px;min-width:40px;height:40px;min-height:40px;padding:0;font-size:19px}.bottom-nav{display:flex;position:fixed;inset:auto 0 0 0;height:calc(66px + env(safe-area-inset-bottom));padding:5px 4px env(safe-area-inset-bottom);align-items:stretch;background:#fff;border-top:1px solid #dbe3ee;box-shadow:0 -5px 20px #0f172a16;z-index:16}.bottom-nav button{flex:1;min-width:0;min-height:56px;border:0;background:transparent;color:#64748b;border-radius:12px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.bottom-nav button.active{color:#1d4ed8;background:#eff6ff}.bottom-nav .nav-icon{font-size:20px;line-height:1}.bottom-nav .nav-label{font-size:9.5px;line-height:1.1;font-weight:750;max-width:100%;overflow:hidden;text-overflow:ellipsis}.main{min-height:100dvh;padding:70px 14px calc(82px + env(safe-area-inset-bottom));overflow:visible}.topbar{align-items:center;gap:10px;margin-bottom:14px}.topbar h1{font-size:23px;line-height:1.15}.topbar .muted{display:none}.topbar>.primary{white-space:nowrap;padding-inline:13px}.stats{grid-template-columns:1fr 1fr;gap:10px}.stat,.panel{padding:14px}.panel{margin-top:12px}.grid2{grid-template-columns:1fr}.modal-backdrop{padding:0;align-items:end;z-index:30}.modal{width:100%;max-height:calc(100dvh - 30px);border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));animation:drawer-up .22s ease-out}.modal-head{top:-18px}.actions{display:grid;grid-template-columns:1fr}.actions button,.actions a,.wide{width:100%}.canvas{height:160px}.table-wrap{overflow:visible}table,thead,tbody,tr,td{display:block;width:100%}table{min-width:0}thead{display:none}tbody{display:grid;gap:12px}tr{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px;box-shadow:0 4px 14px #0f172a0a}td{border:0;padding:7px 0;display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:start;overflow-wrap:anywhere}td::before{content:attr(data-label);font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800}td.actions{display:flex;grid-template-columns:none;margin-top:5px}.media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.toast{left:16px;right:16px;bottom:calc(78px + env(safe-area-inset-bottom))}}
@media(max-width:420px){.stats{grid-template-columns:1fr}.media-grid{grid-template-columns:1fr}.canvas{height:145px}.mobile-user-name{display:none}.auth{padding:14px}.auth-card{padding:22px 18px;overflow:hidden}.auth-card .tabs{display:grid;grid-template-columns:1fr;margin-block:18px}.auth-card .tabs button{width:100%;white-space:normal}.brand-lockup.auth-logo{font-size:24px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
html[data-theme="glass"] body,html.theme-glass body{background-color:#e9f1fb;background-image:radial-gradient(circle at 8% 5%,rgba(147,197,253,.52),transparent 31%),radial-gradient(circle at 92% 16%,rgba(196,181,253,.42),transparent 28%),radial-gradient(circle at 55% 96%,rgba(153,246,228,.34),transparent 34%),linear-gradient(145deg,#e7f0fb,#f2f4fc 52%,#e8f5f1);background-attachment:fixed;color:#14213a}
html[data-theme="glass"] :is(.stat,.panel,.modal,.auth-card,.loading-card,.template-card,.document-card,.calendar-day,.money-summary>div),html.theme-glass :is(.stat,.panel,.modal,.auth-card,.loading-card,.template-card,.document-card,.calendar-day,.money-summary>div){min-width:0;max-width:100%;overflow:hidden;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);box-shadow:0 12px 36px rgba(15,35,65,.08),inset 0 1px 0 rgba(255,255,255,.18);-webkit-backdrop-filter:blur(20px) saturate(145%);backdrop-filter:blur(20px) saturate(145%)}
html[data-theme="glass"] :is(.stat,.panel),html.theme-glass :is(.stat,.panel){padding:20px}html[data-theme="glass"] :is(.template-card,.document-card),html.theme-glass :is(.template-card,.document-card){padding:16px}html[data-theme="glass"] .modal,html.theme-glass .modal{padding:24px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}
html[data-theme="glass"] :is(.panel-head>*,.template-card>*,.document-card>*,.actions,.field,.grid2>*,.setting-copy,.calendar-head>*,td,th),html.theme-glass :is(.panel-head>*,.template-card>*,.document-card>*,.actions,.field,.grid2>*,.setting-copy,.calendar-head>*,td,th){min-width:0;max-width:100%}
html[data-theme="glass"] :is(h1,h2,h3,h4,p,strong,label,.muted,td,th,.nav-label,.badge),html.theme-glass :is(h1,h2,h3,h4,p,strong,label,.muted,td,th,.nav-label,.badge){max-width:100%;overflow-wrap:anywhere;word-wrap:break-word}html[data-theme="glass"] :is(.topbar h1,.panel-head h2,.template-card>div>strong,.document-card>div>strong),html.theme-glass :is(.topbar h1,.panel-head h2,.template-card>div>strong,.document-card>div>strong){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html[data-theme="glass"] :is(button,input,select,textarea),html.theme-glass :is(button,input,select,textarea){max-width:100%}html[data-theme="glass"] button,html.theme-glass button{overflow:hidden;text-overflow:ellipsis}html[data-theme="glass"] .actions,html.theme-glass .actions{flex-wrap:wrap}html[data-theme="glass"] .table-wrap,html.theme-glass .table-wrap{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain}
html[data-theme="glass"] .sidebar,html.theme-glass .sidebar{overflow-x:hidden;overflow-y:auto;background:rgba(10,31,63,.82);border-right:1px solid rgba(255,255,255,.1);box-shadow:10px 0 34px rgba(15,35,65,.09);-webkit-backdrop-filter:blur(20px) saturate(145%);backdrop-filter:blur(20px) saturate(145%)}
html[data-theme="glass"] .mobile-header,html.theme-glass .mobile-header{overflow:hidden;background:rgba(10,31,63,.8);border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 5px 24px rgba(15,35,65,.08);-webkit-backdrop-filter:blur(20px) saturate(145%);backdrop-filter:blur(20px) saturate(145%)}
html[data-theme="glass"] .bottom-nav,html.theme-glass .bottom-nav{overflow:hidden;background:rgba(255,255,255,.42);border:1px solid rgba(255,255,255,.1);box-shadow:0 -8px 28px rgba(15,35,65,.08);-webkit-backdrop-filter:blur(20px) saturate(145%);backdrop-filter:blur(20px) saturate(145%)}
html[data-theme="glass"] .modal-head,html.theme-glass .modal-head{min-width:0;margin:-5px -5px 12px;padding:12px 8px;background:rgba(238,245,252,.78);border-bottom:1px solid rgba(255,255,255,.1);border-radius:12px;-webkit-backdrop-filter:blur(20px) saturate(145%);backdrop-filter:blur(20px) saturate(145%)}html[data-theme="glass"] .modal-head h2,html.theme-glass .modal-head h2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html[data-theme="glass"] :is(.field input,.field select,.field textarea),html.theme-glass :is(.field input,.field select,.field textarea){background:rgba(255,255,255,.5);border-color:rgba(255,255,255,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.36);color:#14213a}html[data-theme="glass"] :is(.field input,.field textarea)::placeholder,html.theme-glass :is(.field input,.field textarea)::placeholder{color:#64748b;opacity:.9}
html[data-theme="glass"] :is(.auth,.app-loading),html.theme-glass :is(.auth,.app-loading){background:transparent}html[data-theme="glass"] .bottom-nav button.active,html.theme-glass .bottom-nav button.active{background:rgba(255,255,255,.46);box-shadow:0 3px 14px rgba(30,64,175,.08)}html[data-theme="glass"] .settings-intro,html.theme-glass .settings-intro{overflow:hidden;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.1)}
.profile-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.icon-button{border:1px solid #ffffff2b;background:#ffffff12;color:inherit;border-radius:10px;padding:8px 10px;min-height:40px}.mobile-settings{border:1px solid #ffffff30;background:#ffffff12;color:white;border-radius:999px;width:40px;min-width:40px;height:40px;min-height:40px;padding:0;font-size:17px}.settings-intro{padding:14px;border-radius:14px;background:#eff6ff;color:#1e3a5f;margin:14px 0}.setting-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 0}.setting-copy{min-width:0}.setting-copy strong{display:block;margin-bottom:4px}.switch{position:relative;display:inline-flex;flex:none;width:54px;height:32px}.switch input{position:absolute;opacity:0;pointer-events:none}.switch-track{position:absolute;inset:0;border-radius:999px;background:#cbd5e1;box-shadow:inset 0 2px 5px #0f172a18;transition:all .22s ease}.switch-track::after{content:"";position:absolute;width:24px;height:24px;left:4px;top:4px;border-radius:50%;background:white;box-shadow:0 3px 8px #0f172a35;transition:transform .22s ease}.switch input:checked+.switch-track{background:#2563eb}.switch input:checked+.switch-track::after{transform:translateX(22px)}.switch input:focus-visible+.switch-track{outline:3px solid #2563eb45;outline-offset:2px}
.theme-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}.theme-option{display:block;min-width:0;cursor:pointer}.theme-option input{position:absolute;opacity:0;pointer-events:none}.theme-option-card{display:grid;place-items:center;gap:7px;min-height:96px;padding:12px 8px;border:1px solid #cbd5e1;border-radius:14px;background:#fff;color:#334155;text-align:center;font-size:13px;font-weight:750;transition:all .2s ease}.theme-option-icon{font-size:25px;line-height:1}.theme-option input:checked+.theme-option-card{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.14);color:#1d4ed8}.theme-option input:focus-visible+.theme-option-card{outline:3px solid rgba(37,99,235,.35);outline-offset:2px}.company-branding{margin-top:22px;padding-top:18px;border-top:1px solid #e2e8f0}.company-logo-preview{display:grid;place-items:center;min-height:110px;padding:14px;border:1px dashed #94a3b8;border-radius:12px;background:#f8fafc}.company-logo-preview img{display:block;max-width:100%;max-height:90px;object-fit:contain}.color-field{grid-template-columns:80px 1fr;align-items:center}.color-field input[type="color"]{height:48px;padding:4px}
@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){html[data-theme="glass"] :is(.stat,.panel,.modal,.bottom-nav,.template-card,.document-card,.calendar-day),html.theme-glass :is(.stat,.panel,.modal,.bottom-nav,.template-card,.document-card,.calendar-day){background:rgba(245,249,253,.94)}}
@media(max-width:768px){html[data-theme="glass"] .main,html.theme-glass .main{padding-left:16px;padding-right:16px}html[data-theme="glass"] :is(.stat,.panel),html.theme-glass :is(.stat,.panel){padding:16px}html[data-theme="glass"] .modal-backdrop,html.theme-glass .modal-backdrop{padding:8px 8px 0}html[data-theme="glass"] .modal,html.theme-glass .modal{width:100%;padding:18px 16px calc(18px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0}html[data-theme="glass"] tbody tr,html.theme-glass tbody tr{min-width:0;max-width:100%;overflow:hidden;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);box-shadow:0 8px 24px rgba(15,35,65,.07);-webkit-backdrop-filter:blur(20px) saturate(145%);backdrop-filter:blur(20px) saturate(145%)}html[data-theme="glass"] :is(.template-card,.document-card,.template-field-row,.document-line),html.theme-glass :is(.template-card,.document-card,.template-field-row,.document-line){width:100%;min-width:0;overflow:hidden}html[data-theme="glass"] .calendar-head h2,html.theme-glass .calendar-head h2{min-width:0}html[data-theme="glass"] .document-line>*,html.theme-glass .document-line>*{min-width:0;max-width:100%}}
html[data-theme="dark"],html.theme-dark{color-scheme:dark}html[data-theme="dark"] body,html.theme-dark body{background:#0b1120;color:#e5edf8}html[data-theme="dark"] :is(.main,.auth,.app-loading),html.theme-dark :is(.main,.auth,.app-loading){background:transparent;color:#e5edf8}
html[data-theme="dark"] :is(.stat,.panel,.modal,.auth-card,.loading-card,.template-card,.document-card,.calendar-day),html.theme-dark :is(.stat,.panel,.modal,.auth-card,.loading-card,.template-card,.document-card,.calendar-day){background:#111c2e;border-color:#26364e;color:#e5edf8;box-shadow:0 14px 38px rgba(0,0,0,.2)}html[data-theme="dark"] :is(.sidebar,.mobile-header),html.theme-dark :is(.sidebar,.mobile-header){background:#07101d;color:#f8fafc;border-color:#1e293b}html[data-theme="dark"] .bottom-nav,html.theme-dark .bottom-nav{background:#0f1929;border-color:#26364e;box-shadow:0 -8px 28px rgba(0,0,0,.28)}
html[data-theme="dark"] :is(h1,h2,h3,h4,strong),html.theme-dark :is(h1,h2,h3,h4,strong){color:#f8fafc}html[data-theme="dark"] .muted,html.theme-dark .muted{color:#94a3b8}html[data-theme="dark"] .field label,html.theme-dark .field label{color:#cbd5e1}html[data-theme="dark"] :is(.field input,.field select,.field textarea),html.theme-dark :is(.field input,.field select,.field textarea){background:#0c1626;border-color:#334155;color:#f8fafc;box-shadow:none}html[data-theme="dark"] :is(.field input,.field textarea)::placeholder,html.theme-dark :is(.field input,.field textarea)::placeholder{color:#718096}html[data-theme="dark"] :is(.field input,.field select,.field textarea):focus,html.theme-dark :is(.field input,.field select,.field textarea):focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.16)}
html[data-theme="dark"] .secondary,html.theme-dark .secondary{background:#1e2b3e;color:#dbeafe}html[data-theme="dark"] .danger,html.theme-dark .danger{background:#451a1a;color:#fecaca}html[data-theme="dark"] :is(th,td),html.theme-dark :is(th,td){border-color:#26364e}html[data-theme="dark"] th,html.theme-dark th{color:#94a3b8}html[data-theme="dark"] .badge,html.theme-dark .badge{background:#172e52;color:#bfdbfe}html[data-theme="dark"] .badge.off,html.theme-dark .badge.off{background:#253247;color:#cbd5e1}html[data-theme="dark"] .empty,html.theme-dark .empty{color:#94a3b8}
html[data-theme="dark"] .tabs button,html.theme-dark .tabs button{background:#1e2b3e;color:#cbd5e1}html[data-theme="dark"] .tabs button.active,html.theme-dark .tabs button.active{background:#2563eb;color:#fff}html[data-theme="dark"] .error,html.theme-dark .error{background:#3f171b;color:#fecaca}html[data-theme="dark"] hr,html.theme-dark hr{border-color:#334155}
html[data-theme="dark"] .modal-backdrop,html.theme-dark .modal-backdrop{background:rgba(2,6,23,.78)}html[data-theme="dark"] .modal-head,html.theme-dark .modal-head{background:#111c2e;border-color:#26364e}html[data-theme="dark"] .close,html.theme-dark .close{color:#f8fafc}html[data-theme="dark"] :is(.template-field-row,.document-line),html.theme-dark :is(.template-field-row,.document-line){border-color:#334155;background:#0f1929}html[data-theme="dark"] .money-summary>div,html.theme-dark .money-summary>div{background:#17243a;color:#e5edf8}html[data-theme="dark"] .settings-intro,html.theme-dark .settings-intro{background:#15243a;color:#dbeafe;border:1px solid #2b3d58}
html[data-theme="dark"] .calendar-event,html.theme-dark .calendar-event{background:#17345d;color:#dbeafe}html[data-theme="dark"] .calendar-day.today,html.theme-dark .calendar-day.today{outline-color:#60a5fa}html[data-theme="dark"] .bottom-nav button,html.theme-dark .bottom-nav button{color:#94a3b8}html[data-theme="dark"] .bottom-nav button.active,html.theme-dark .bottom-nav button.active{background:#172e52;color:#bfdbfe}html[data-theme="dark"] a,html.theme-dark a{color:#93c5fd}html[data-theme="dark"] :is(.media-item img,.canvas),html.theme-dark :is(.media-item img,.canvas){background:#fff;border-color:#334155}
html[data-theme="dark"] .theme-option-card,html.theme-dark .theme-option-card{background:#0c1626;border-color:#334155;color:#cbd5e1}html[data-theme="dark"] .theme-option input:checked+.theme-option-card,html.theme-dark .theme-option input:checked+.theme-option-card{border-color:#60a5fa;color:#bfdbfe;box-shadow:0 0 0 3px rgba(96,165,250,.14)}html[data-theme="dark"] .skeleton,html.theme-dark .skeleton{background:linear-gradient(90deg,#17243a 25%,#26364e 50%,#17243a 75%);background-size:200% 100%}
@media(max-width:768px){html[data-theme="dark"] body,html.theme-dark body{background:#0b1120}html[data-theme="dark"] tbody tr,html.theme-dark tbody tr{background:#111c2e;border-color:#26364e;box-shadow:0 6px 20px rgba(0,0,0,.18)}html[data-theme="dark"] td::before,html.theme-dark td::before{color:#94a3b8}}@media(max-width:420px){.theme-options{grid-template-columns:1fr}.theme-option-card{min-height:64px;grid-template-columns:auto 1fr;justify-items:start;text-align:left;padding-inline:16px}}
.quick-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:18px}.quick-actions button{text-align:left;padding:14px}.calendar-head{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:14px}.calendar-head h2{min-width:190px;text-align:center}.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.calendar-weekday{text-align:center;color:#64748b;font-size:12px;font-weight:800;padding:6px}.calendar-day{min-height:92px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:8px;text-align:left;overflow:hidden}.calendar-day.outside{opacity:.42}.calendar-day.today{outline:2px solid #2563eb}.calendar-number{font-weight:800;font-size:12px}.calendar-event{display:block;width:100%;min-height:0;margin-top:5px;padding:5px;border:0;border-radius:7px;background:#dbeafe;color:#1e40af;font-size:10px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.template-list,.document-list{display:grid;gap:10px}.template-card,.document-card{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff}.template-fields{display:grid;gap:8px}.template-field-row,.document-line{display:grid;grid-template-columns:minmax(0,2fr) repeat(3,minmax(90px,1fr)) auto;gap:8px;align-items:end;padding:10px;border:1px solid #e2e8f0;border-radius:10px}.template-field-row{grid-template-columns:1fr auto;align-items:center}.builder-palette{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.money-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.money-summary div{padding:12px;border-radius:10px;background:#eff6ff}.more-menu{display:grid;grid-template-columns:1fr 1fr;gap:10px}.more-menu button{width:100%}
.template-field-row{display:block;min-width:0}.template-field-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.template-field-toolbar strong{white-space:nowrap}.template-field-config{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.template-field-config .full{grid-column:1/-1}.template-field-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:8px}.template-field-actions button{min-height:38px}.template-preview{margin-top:16px}.template-preview summary{cursor:pointer;font-weight:800}.template-preview>[inert]{margin-top:10px}.report-fields-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.report-field{min-width:0}.report-field.full,.report-section-title,.report-page-break{grid-column:1/-1}.field-help{display:block;color:#64748b;font-size:12px;line-height:1.4}.checkbox-options{display:grid;gap:8px;margin-top:4px}.checkbox-options label{display:flex;align-items:center;gap:8px;font-weight:500}.report-table{grid-column:1/-1;overflow-x:auto}.report-table table{min-width:540px}.report-table input{min-width:90px}.report-table-actions{display:flex;justify-content:flex-end;margin-top:8px}.report-table .danger{min-height:36px;padding:7px 10px}.report-table-total{text-align:right;font-weight:800;margin-top:8px}
@media(max-width:768px){.calendar-day{min-height:67px;padding:5px}.calendar-grid{gap:3px}.calendar-event{font-size:0;height:7px;padding:0}.calendar-event::after{content:""}.document-line{grid-template-columns:1fr 1fr}.document-line .line-description{grid-column:1/-1}.money-summary{grid-template-columns:1fr}.template-card,.document-card{align-items:flex-start;flex-direction:column}.more-menu{grid-template-columns:1fr}.template-field-config,.report-fields-grid{grid-template-columns:1fr}.template-field-config .full,.report-field.full,.report-section-title,.report-page-break{grid-column:1}.template-field-actions{display:grid;grid-template-columns:1fr 1fr}.template-field-actions label{grid-column:1/-1}.template-field-actions .danger{grid-column:1/-1}}
.install-button[hidden]{display:none!important}.offline-card{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));text-align:center}.offline-card>div{width:min(440px,100%);padding:28px;border-radius:20px;background:#fff;border:1px solid #dbe3ee;box-shadow:0 18px 50px #10233f18}.client-tabs{display:flex;gap:7px;overflow-x:auto;padding:2px 0 10px}.client-tabs button{white-space:nowrap}.client-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.detail-box{min-width:0;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.detail-box strong{display:block;margin-bottom:5px}.related-list{display:grid;gap:9px}.related-card{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:13px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:inherit;text-align:left}.related-card>span{min-width:0}.related-card small{display:block;color:#64748b;margin-top:4px}.logo-preview-pending{outline:3px solid #2563eb35;outline-offset:2px}.pwa-help{padding:14px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#1e3a5f}.pwa-help p{margin:6px 0 0}.modal,.main,.panel,.related-card{max-width:100%}body{overflow-x:hidden}
html[data-theme="dark"] :is(.detail-box,.related-card,.offline-card>div),html.theme-dark :is(.detail-box,.related-card,.offline-card>div){background:#111c2e;border-color:#26364e;color:#e5edf8}html[data-theme="dark"] .pwa-help,html.theme-dark .pwa-help{background:#15243a;border-color:#2b3d58;color:#dbeafe}
@media(max-width:768px){.client-detail-grid{grid-template-columns:1fr}.client-tabs{margin-inline:-4px}.related-card{min-height:58px}.mobile-header{padding-top:env(safe-area-inset-top);padding-left:calc(14px + env(safe-area-inset-left));padding-right:calc(14px + env(safe-area-inset-right));height:calc(54px + env(safe-area-inset-top))}.main{padding-top:calc(70px + env(safe-area-inset-top));padding-left:calc(14px + env(safe-area-inset-left));padding-right:calc(14px + env(safe-area-inset-right))}.bottom-nav{padding-left:calc(4px + env(safe-area-inset-left));padding-right:calc(4px + env(safe-area-inset-right))}}
.ui-icon{display:inline-block;width:20px;height:20px;flex:0 0 auto;vertical-align:-.2em}.nav button,.primary,.secondary,.danger,.icon-button,.mobile-settings,.mobile-logout{display:inline-flex;align-items:center;justify-content:center;gap:8px}.nav button{justify-content:flex-start}.nav .ui-icon{width:19px;height:19px}.bottom-nav .nav-icon{display:grid;place-items:center;height:25px}.bottom-nav .ui-icon{width:22px;height:22px}.icon-only{width:44px;min-width:44px;height:44px;padding:0;border-radius:12px}.close{display:grid;place-items:center}.close .ui-icon{width:24px;height:24px}.quick-actions button{display:flex;align-items:center;gap:10px}.quick-actions .ui-icon{width:21px;height:21px}.media-delete{display:grid;place-items:center}.media-delete .ui-icon{width:18px;height:18px}.file-upload{display:grid;gap:8px;margin:14px 0;min-width:0}.file-upload-label{font-size:13px;font-weight:700;color:#475569}.file-upload-dropzone{display:flex;align-items:center;gap:14px;min-height:112px;padding:18px;border:1.5px dashed #94a3b8;border-radius:14px;background:#f8fafc;color:#29415f;cursor:pointer;transition:border-color .2s ease,background .2s ease,box-shadow .2s ease}.file-upload-dropzone:hover,.file-upload-dropzone.is-dragover{border-color:#2563eb;background:#eff6ff}.file-upload-dropzone:focus-visible{outline:3px solid #2563eb45;outline-offset:2px}.file-upload-icon{display:grid;place-items:center;width:48px;height:48px;flex:none;border-radius:12px;background:#e7eef8;color:#1d4ed8}.file-upload-icon .ui-icon{width:25px;height:25px}.file-upload-copy{display:grid;gap:3px;min-width:0}.file-upload-copy strong{font-size:15px}.file-upload-copy small,.file-upload-name{display:block;color:#64748b;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-upload-preview{display:none;position:relative;align-items:center;gap:10px;min-height:58px;padding:8px 54px 8px 8px;border:1px solid #dbe3ee;border-radius:12px;background:#fff}.file-upload-preview.is-visible{display:flex}.file-upload-preview img{display:block;width:74px;height:54px;object-fit:contain;border-radius:8px;background:#fff}.file-upload-clear{position:absolute;right:8px;top:50%;translate:0 -50%;display:grid;place-items:center;width:40px;min-width:40px;height:40px;min-height:40px;padding:0;border:0;border-radius:10px;background:#fee2e2;color:#b91c1c}.file-upload-status{min-height:18px;margin:0;color:#166534;font-size:12px}.file-upload.is-error .file-upload-dropzone{border-color:#dc2626;background:#fef2f2}.file-upload.is-error .file-upload-status{color:#b91c1c}.file-upload.is-success .file-upload-dropzone{border-color:#16a34a}.toast{display:flex;align-items:flex-start;gap:10px;min-height:48px;box-shadow:0 12px 32px #0f172a30}.modal-head{gap:14px;border-bottom:1px solid #edf1f7}.modal-head h2{line-height:1.2;overflow-wrap:anywhere}.client-tabs,.tabs{scrollbar-width:thin;overscroll-behavior-inline:contain}.client-tabs button{flex:0 0 auto}.field input[type="checkbox"]{width:20px;height:20px;min-height:20px;accent-color:#2563eb}button:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:3px solid #2563eb55;outline-offset:2px}
html[data-theme="dark"] :is(.file-upload-dropzone,.file-upload-preview),html.theme-dark :is(.file-upload-dropzone,.file-upload-preview){background:#0c1626;border-color:#334155;color:#dbeafe}html[data-theme="dark"] .file-upload-icon,html.theme-dark .file-upload-icon{background:#172e52;color:#bfdbfe}html[data-theme="dark"] .file-upload-label,html.theme-dark .file-upload-label{color:#cbd5e1}html[data-theme="dark"] .file-upload-dropzone:hover,html.theme-dark .file-upload-dropzone:hover{background:#15243a;border-color:#60a5fa}html[data-theme="glass"] :is(.file-upload-dropzone,.file-upload-preview),html.theme-glass :is(.file-upload-dropzone,.file-upload-preview){background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.42);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
@media(max-width:768px){.file-upload-dropzone{min-height:104px;padding:14px}.file-upload-copy small,.file-upload-name{white-space:normal;overflow-wrap:anywhere}.modal-head{padding-bottom:12px}.client-tabs{margin-inline:-18px;padding-inline:18px}.topbar{min-width:0}.topbar>div{min-width:0}.topbar h1{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.primary,.secondary,.danger{min-height:46px}.quick-actions button{min-height:52px}.bottom-nav .nav-label{font-size:10px}.company-branding{min-width:0}.theme-options{overflow:hidden}}
.bottom-nav [data-mobile-nav-item]{position:relative;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,opacity .18s ease}.bottom-nav.is-reordering{overflow:visible}.bottom-nav.is-reordering [data-mobile-nav-item]{touch-action:none}.bottom-nav [data-mobile-nav-item].is-lifted{position:fixed;z-index:40;transform:translateY(-15px) scale(1.1)!important;background:#fff!important;color:#1d4ed8!important;box-shadow:0 12px 28px #0f172a35!important;pointer-events:none;transition:transform .12s ease,box-shadow .12s ease}.bottom-nav .nav-placeholder{flex:1;min-width:0;min-height:56px;border:2px dashed #93c5fd;border-radius:12px;background:#eff6ff;opacity:.48;transition:all .18s ease}.bottom-nav.is-reordering [data-mobile-nav-item]:not(.is-lifted){opacity:.76}.bottom-nav.is-reordering #mobile-more{opacity:.45;pointer-events:none}html[data-theme="dark"] .bottom-nav [data-mobile-nav-item].is-lifted,html.theme-dark .bottom-nav [data-mobile-nav-item].is-lifted{background:#172e52!important;color:#bfdbfe!important}html[data-theme="dark"] .bottom-nav .nav-placeholder,html.theme-dark .bottom-nav .nav-placeholder{background:#172e52;border-color:#60a5fa}html[data-theme="glass"] .bottom-nav [data-mobile-nav-item].is-lifted,html.theme-glass .bottom-nav [data-mobile-nav-item].is-lifted{background:rgba(255,255,255,.88)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}.nav-customizer{display:grid;gap:8px}.nav-customizer-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.nav-customizer-row>span{display:flex;align-items:center;gap:9px;min-width:0}.nav-customizer-row .actions{flex-wrap:nowrap}.nav-customizer-row.is-more{opacity:.72}.nav-customizer-divider{margin:10px 0 2px;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase}html[data-theme="dark"] .nav-customizer-row,html.theme-dark .nav-customizer-row{background:#0c1626;border-color:#334155}
.topbar-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}.notification-button{position:relative}.notification-count{position:absolute;top:-5px;right:-5px;display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:800}.search-results,.notification-list,.activity-list{display:grid;gap:9px}.search-result,.notification-item,.activity-item{width:100%;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:inherit;text-align:left}.notification-item.unread{border-left:4px solid #2563eb}.notification-item small,.activity-item small,.search-result small{display:block;margin-top:4px;color:#64748b}.autosave-status{display:flex;align-items:center;gap:7px;min-height:28px;margin:8px 0;color:#64748b;font-size:12px}.autosave-status.saving{color:#1d4ed8}.autosave-status.saved{color:#166534}.autosave-status.error,.autosave-status.dirty{color:#b45309}.template-field-row[draggable="true"]{cursor:grab}.template-field-row.is-dragging{opacity:.55;outline:2px dashed #2563eb}.drag-handle{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-size:12px}.pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px}.table-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.table-tools input,.table-tools select{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;background:#fff}.table-tools input{flex:1 1 220px}html[data-theme="dark"] :is(.search-result,.notification-item,.activity-item,.table-tools input,.table-tools select),html.theme-dark :is(.search-result,.notification-item,.activity-item,.table-tools input,.table-tools select){background:#0c1626;border-color:#334155;color:#e5edf8}@media(max-width:768px){.topbar-actions{flex:0 0 auto}.topbar-actions>#add-clients,.topbar-actions>#add-equipements,.topbar-actions>#add-interventions,.topbar-actions>#add-modeles,.topbar-actions>#add-documents,.topbar-actions>#add-equipe{padding-inline:10px}.search-result,.notification-item,.activity-item{min-height:58px}}
`;
document.head.insertAdjacentHTML("beforeend", `<style>${styles}</style>`);
document.head.insertAdjacentHTML("beforeend", `<style>.auth-footer{margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;text-align:center}html[data-theme="glass"] .bottom-nav.is-reordering,html.theme-glass .bottom-nav.is-reordering{overflow:visible}.bottom-nav [data-mobile-nav-item]{touch-action:pan-y;-webkit-touch-callout:none;user-select:none}</style>`);
document.head.insertAdjacentHTML("beforeend", `<style>
.template-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.template-field-row.compact{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px;cursor:grab}.template-field-row.compact.full{grid-column:1/-1}.template-field-row.compact.half{grid-column:span 1}.template-field-row.compact .drag-handle{width:32px;height:42px;justify-content:center;border-radius:9px;background:#f1f5f9}.template-card-copy{min-width:0}.template-card-copy strong{display:block;margin-bottom:4px}.template-card-summary{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.template-card-summary .badge{padding:3px 7px;font-size:10px}.template-card-summary small{color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.template-card-actions{display:flex;align-items:center;gap:6px}.section-drawer-backdrop{position:fixed;inset:0;background:#0f172a80;z-index:70;animation:backdrop-in .18s ease}.section-drawer{position:absolute;inset:0 0 0 auto;width:min(560px,100%);display:flex;flex-direction:column;background:#fff;box-shadow:-18px 0 48px #0f172a2b;animation:drawer-left .22s ease-out}.section-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e2e8f0}.section-drawer-head h2{margin:0;font-size:19px}.section-drawer-tabs{display:flex;gap:6px;padding:12px 18px 0}.section-drawer-tabs button{flex:1}.section-drawer-body{flex:1;overflow:auto;padding:8px 18px 100px}.section-drawer-footer{position:absolute;inset:auto 0 0;display:grid;grid-template-columns:auto 1fr;gap:8px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e2e8f0}.section-setting-group{padding:14px 0;border-bottom:1px solid #edf1f7}.section-setting-group h3{margin:0 0 10px;font-size:14px}.setting-check{display:flex;align-items:center;gap:10px;min-height:44px}.section-type-help{margin:8px 0 0;padding:10px;border-radius:10px;background:#eff6ff;color:#475569;font-size:12px}.advanced-column-list{display:grid;gap:10px}.advanced-column{padding:12px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc}.advanced-column-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.advanced-column .actions{align-items:center}.advanced-column .actions label{display:flex;align-items:center;gap:5px;font-size:12px}.column-preview-list{display:grid;gap:6px;margin-top:8px}.column-preview-row{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #e2e8f0;border-radius:9px}.column-preview-row span:first-child{color:#94a3b8}.column-preview-row strong{flex:1}.list-mode-segments{display:flex;flex-wrap:wrap}.list-mode-segments label{padding:8px 12px;border:1px solid #cbd5e1;border-radius:999px}@keyframes drawer-left{from{transform:translateX(100%)}to{transform:none}}html[data-theme="dark"] .section-drawer,html.theme-dark .section-drawer{background:#111c2e;color:#e5edf8}html[data-theme="dark"] :is(.section-drawer-head,.section-drawer-footer,.section-setting-group),html.theme-dark :is(.section-drawer-head,.section-drawer-footer,.section-setting-group){background:#111c2e;border-color:#334155}html[data-theme="dark"] :is(.template-field-row.compact .drag-handle,.advanced-column),html.theme-dark :is(.template-field-row.compact .drag-handle,.advanced-column){background:#1e2b3e;border-color:#334155}@media(max-width:768px){.template-fields{grid-template-columns:1fr}.template-field-row.compact.full,.template-field-row.compact.half{grid-column:1}.template-field-row.compact{grid-template-columns:auto minmax(0,1fr) auto;padding:12px 10px}.template-card-actions [data-move-template-up],.template-card-actions [data-move-template-down]{display:none}.section-drawer{width:100%}.section-drawer-body{padding-inline:16px}.advanced-column .grid2{grid-template-columns:1fr}.report-field.half{grid-column:1}.report-table{overflow-x:visible}.report-table table{min-width:0}}
</style>`);

document.addEventListener("DOMContentLoaded", async () => {
    initPwa();
    await initApp();
});

function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
}

function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function updateInstallUi() {
    const canInstall = Boolean(deferredInstallPrompt) && !isStandaloneMode();
    document.querySelectorAll("[data-install-app]").forEach((button) => {
        button.hidden = !canInstall;
    });
}

async function installIntervium() {
    if (!deferredInstallPrompt || isStandaloneMode()) return;
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    updateInstallUi();
}

function initPwa() {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        updateInstallUi();
    });
    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        updateInstallUi();
        toast("Intervium est installé sur cet appareil.");
    });
    window.addEventListener("online", () => {
        if (document.querySelector(".offline-card")) initApp();
        else toast("Connexion rétablie.");
    });
    window.addEventListener("offline", () => toast("Connexion perdue. Les données privées ne sont pas mises en cache.", true));
    window.addEventListener("popstate", (event) => {
        if (!currentUser) return;
        renderMain(event.state?.view || viewFromLocation());
    });

    if ("serviceWorker" in navigator && window.isSecureContext) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
            serviceWorkerRegistration = registration;
            registration.update().catch(() => {});
            if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
            registration.addEventListener("updatefound", () => {
                const worker = registration.installing;
                worker?.addEventListener("statechange", () => {
                    if (worker.state === "installed" && navigator.serviceWorker.controller) {
                        worker.postMessage({ type: "SKIP_WAITING" });
                    }
                });
            });
        }).catch((error) => console.error("Service worker non enregistré", error));
    }
}

function viewFromLocation() {
    const view = location.hash.replace(/^#/, "");
    return ["dashboard", "interventions", "planning", "clients", "equipements", "modeles", "documents", "equipe", "activity"].includes(view)
        ? view
        : "dashboard";
}

function navigateTo(view, replace = false) {
    const method = replace ? "replaceState" : "pushState";
    history[method]({ view }, "", `#${view}`);
    renderMain(view);
}

async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
            credentials: "include",
        });
    } catch {
        throw new Error("Le serveur est inaccessible. Vérifiez qu'il est bien démarré.");
    }

    if (response.status === 401 && path !== "/auth/login") {
        currentUser = null;
        showAuth();
        throw new Error("Votre session a expiré.");
    }

    let data = null;
    if (response.status !== 204) {
        const text = await response.text();
        if (text) {
            try { data = JSON.parse(text); }
            catch { data = response.ok ? text : null; }
        }
    }
    if (!response.ok) {
        const error = new Error(data?.error || `La requête a échoué (${response.status}).`);
        error.status = response.status;
        error.code = data?.code;
        throw error;
    }
    return data;
}

function showOfflineScreen(message = "Les données sécurisées nécessitent une connexion au serveur.") {
    app.innerHTML = `<main class="offline-card"><div>${logoLockup("auth-logo")}<h1>Mode hors connexion</h1><p class="muted">${escapeHtml(message)}</p><button class="primary" id="offline-retry">Réessayer</button></div></main>`;
    document.getElementById("offline-retry").addEventListener("click", initApp);
}

async function initApp() {
    app.innerHTML = `<div class="app-loading"><div class="loading-card">${logoLockup("auth-logo")}<span class="spinner large" aria-hidden="true"></span><span class="sr-only">Chargement de l’application</span><div class="skeletons" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div></div>`;
    try {
        const session = await api("/auth/me");
        currentUser = session.user;
        currentEntreprise = session.entreprise;
        await loadAllData();
        navigateTo(viewFromLocation(), true);
    } catch (error) {
        if (!navigator.onLine || /connexion|serveur inaccessible/i.test(error.message)) {
            showOfflineScreen(error.message);
        } else if (!currentUser) showAuth();
        else {
            renderMain("dashboard");
            toast(error.message, true);
        }
    }
}

function showAuth(mode = "login") {
    app.innerHTML = `
      <main class="auth"><section class="auth-card">
        ${logoLockup("auth-logo")}<p class="muted">Gestion sécurisée des interventions</p>
        <div class="tabs"><button data-auth-tab="login" class="${mode === "login" ? "active" : ""}">Connexion</button><button data-auth-tab="register" class="${mode === "register" ? "active" : ""}">Créer une entreprise</button></div>
        <div id="auth-error" class="error hidden"></div>
        <form id="login-form" class="${mode === "login" ? "" : "hidden"}">
          ${field("Email", "email", "email", true)}${field("Mot de passe", "password", "password", true)}
          <button class="primary wide" type="submit">Se connecter</button>
        </form><footer class="auth-footer">Conçu par Sylvain Lecoeuvre</footer>
        <form id="register-form" class="${mode === "register" ? "" : "hidden"}">
          ${field("Nom de l’entreprise", "nom_entreprise", "text", true)}${field("Votre nom", "nom", "text", true)}${field("Email", "email", "email", true)}${field("Mot de passe (8 caractères minimum)", "password", "password", true)}
          <button class="primary wide" type="submit">Créer mon espace</button>
        </form>
      </section></main>`;

    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
        button.addEventListener("click", () => showAuth(button.dataset.authTab));
    });
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("register-form").addEventListener("submit", handleRegister);
}

function field(label, name, type = "text", required = false, value = "") {
    return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""}></div>`;
}

// Sous-ensemble Lucide embarqué : une seule grammaire visuelle, sans dépendance réseau.
const ICON_PATHS = {
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    interventions: '<rect width="14" height="18" x="5" y="3" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    equipment: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M3 12l9 5 9-5M3 16l9 5 9-5"/>',
    template: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 3v6l2-1 2 1V3M7 15h10"/>',
    documents: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.35.73.6 1 .3.3.68.45 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    glass: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
};

function icon(name, extraClass = "") {
    const paths = ICON_PATHS[name] || ICON_PATHS.alert;
    return `<svg class="ui-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function fileUpload({ id, name, label, help, accept, maxMb = 5, capture = "", previewUrl = "" }) {
    return `<div class="file-upload" data-file-upload data-max-mb="${maxMb}">
      <label class="file-upload-label" for="${id}">${escapeHtml(label)}</label>
      <input class="file-upload-input sr-only" id="${id}" name="${name}" type="file" accept="${accept}" ${capture ? `capture="${capture}"` : ""}>
      <div class="file-upload-dropzone" tabindex="0" role="button" aria-controls="${id}" aria-describedby="${id}-help">
        <span class="file-upload-icon">${icon("upload")}</span>
        <span class="file-upload-copy"><strong>Choisir un fichier</strong><small id="${id}-help">${escapeHtml(help)} · ${maxMb} Mo maximum</small><span class="file-upload-name">Aucun fichier sélectionné</span></span>
      </div>
      <div class="file-upload-preview ${previewUrl ? "is-visible" : ""}" aria-live="polite">${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="Aperçu du fichier actuel">` : ""}<button class="file-upload-clear" type="button" aria-label="Retirer le fichier sélectionné" title="Retirer">${icon("trash")}</button></div>
      <p class="file-upload-status" role="status" aria-live="polite"></p>
    </div>`;
}

function bindFileUpload(root, { onChange } = {}) {
    const component = typeof root === "string" ? document.querySelector(root) : root;
    if (!component) return;
    const input = component.querySelector(".file-upload-input");
    const zone = component.querySelector(".file-upload-dropzone");
    const preview = component.querySelector(".file-upload-preview");
    const name = component.querySelector(".file-upload-name");
    const status = component.querySelector(".file-upload-status");
    let objectUrl = null;
    const choose = () => input.click();
    const update = () => {
        const file = input.files?.[0];
        component.classList.remove("is-error", "is-success");
        input.setCustomValidity("");
        status.textContent = "";
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (!file) { name.textContent = "Aucun fichier sélectionné"; preview.classList.remove("is-visible"); preview.querySelector("img")?.remove(); onChange?.(null, component); return; }
        const maxBytes = Number(component.dataset.maxMb || 5) * 1024 * 1024;
        const acceptedTypes = input.accept.split(",").map((value) => value.trim()).filter(Boolean);
        const typeAllowed = !acceptedTypes.length || acceptedTypes.some((accepted) => accepted.endsWith("/*") ? file.type.startsWith(accepted.slice(0, -1)) : file.type === accepted);
        if (!typeAllowed) {
            input.setCustomValidity("Ce format de fichier n’est pas accepté.");
            component.classList.add("is-error"); status.textContent = input.validationMessage; name.textContent = file.name; onChange?.(file, component); return;
        }
        if (file.size > maxBytes) {
            input.setCustomValidity(`Le fichier dépasse la limite de ${component.dataset.maxMb} Mo.`);
            component.classList.add("is-error"); status.textContent = input.validationMessage; name.textContent = file.name; onChange?.(file, component); return;
        }
        name.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} Mo`;
        if (file.type.startsWith("image/")) {
            objectUrl = URL.createObjectURL(file);
            let image = preview.querySelector("img");
            if (!image) { image = document.createElement("img"); image.alt = "Aperçu du fichier sélectionné"; preview.prepend(image); }
            image.src = objectUrl; preview.classList.add("is-visible");
        }
        component.classList.add("is-success"); status.textContent = "Fichier prêt à être envoyé."; onChange?.(file, component);
    };
    zone.addEventListener("click", choose);
    zone.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); choose(); } });
    ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-dragover"); }));
    zone.addEventListener("drop", (event) => { if (event.dataTransfer?.files?.length) { const transfer = new DataTransfer(); transfer.items.add(event.dataTransfer.files[0]); input.files = transfer.files; update(); } });
    input.addEventListener("change", update);
    component.querySelector(".file-upload-clear").addEventListener("click", () => { input.value = ""; update(); });
}

function logoSvg() {
    return `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 3.5 41 10v12.6c0 10.2-6.7 18.3-17 21.9C13.7 40.9 7 32.8 7 22.6V10L24 3.5Z" fill="currentColor" opacity=".2"/><path d="M24 5.8 38.5 11v11.6c0 8.5-5.4 15.4-14.5 18.9-9.1-3.5-14.5-10.4-14.5-18.9V11L24 5.8Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m16.4 23.8 5 5 10.8-11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function logoLockup(extraClass = "") {
    return `<div class="brand-lockup ${extraClass}" aria-label="Intervium">${logoSvg()}<span>Intervium</span></div>`;
}

function storedTheme() {
    try { return localStorage.getItem(FUTURE_THEME_STORAGE_KEY) || localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
}

function applyStoredTheme() {
    const stored = storedTheme();
    const theme = ["glass", "dark"].includes(stored) ? stored : "classic";
    if (theme !== "classic") document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.toggle("theme-glass", theme === "glass");
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
        themeColor = document.createElement("meta");
        themeColor.name = "theme-color";
        document.head.append(themeColor);
    }
    themeColor.content = theme === "dark" ? "#0b1120" : theme === "glass" ? "#e9f1fb" : "#f3f6fb";
    return theme;
}

function setTheme(theme) {
    const value = ["glass", "dark"].includes(theme) ? theme : "classic";
    try {
        if (value !== "classic") { localStorage.setItem(THEME_STORAGE_KEY, value); localStorage.setItem(FUTURE_THEME_STORAGE_KEY, value); }
        else { localStorage.removeItem(THEME_STORAGE_KEY); localStorage.removeItem(FUTURE_THEME_STORAGE_KEY); }
    } catch {}
    return applyStoredTheme();
}

function authError(message) {
    const box = document.getElementById("auth-error");
    box.textContent = message;
    box.classList.remove("hidden");
}

function formFromSubmitEvent(event) {
    const form = event?.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
        throw new TypeError("Le formulaire HTML est indisponible.");
    }
    return form;
}

async function handleLogin(event) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            await api("/auth/login", { method: "POST", body: JSON.stringify(values) });
            await initApp();
        } catch (error) { authError(error.message); }
    });
}

async function handleRegister(event) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            await api("/auth/register", { method: "POST", body: JSON.stringify(values) });
            await api("/auth/login", { method: "POST", body: JSON.stringify({ email: values.email, password: values.password }) });
            await initApp();
        } catch (error) { authError(error.message); }
    });
}

async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    currentUser = null;
    currentEntreprise = null;
    showAuth();
}

async function loadAllData() {
    googleMailStatus = await api("/google/status").catch(() => ({ enabled: false, connection: null }));
    if (currentUser.role === "CLIENT") {
        interventions = await api("/interventions");
        clients = [];
        equipements = [];
        technicians = [];
        creationClients = [];
        creationEquipements = [];
        reportTemplates = [];
        commercialDocuments = [];
        return;
    }
    const results = await Promise.allSettled([
        api("/interventions"),
        api("/clients"),
        api("/equipements"),
        currentUser.role === "ADMIN" ? api("/auth/users") : Promise.resolve([]),
        api("/interventions/options"),
        api("/modeles"),
        currentUser.role === "ADMIN" ? api("/documents") : Promise.resolve([]),
    ]);
    const stateTargets = [
        (value) => { interventions = value; },
        (value) => { clients = value; },
        (value) => { equipements = value; },
        (value) => { technicians = value; },
        (value) => {
            creationClients = value.clients || [];
            creationEquipements = value.equipements || [];
        },
        (value) => { reportTemplates = value; },
        (value) => { commercialDocuments = value; },
    ];
    const failures = [];
    results.forEach((result, index) => {
        if (result.status === "fulfilled") stateTargets[index](result.value);
        else failures.push(result.reason?.message || "Données indisponibles");
    });
    if (failures.length) {
        throw new Error(`Certaines données n'ont pas pu être chargées : ${[...new Set(failures)].join(" ")}`);
    }
}

function renderMain(view = "dashboard") {
    currentView = view;
    const mobileNavigation = renderMobileNavigation(view);
    app.innerHTML = `<div class="shell">
      <aside class="sidebar"><div>${logoLockup()}<div class="muted">${escapeHtml(currentEntreprise?.nom || "")}</div></div>
        <nav class="nav">${navButton("dashboard", "Tableau de bord", view, "home")}${navButton("interventions", "Rapports", view, "interventions")}${currentUser.role === "CLIENT" ? "" : `${navButton("planning", "Planning", view, "calendar")}${navButton("clients", "Clients", view, "clients")}${navButton("equipements", "Équipements", view, "equipment")}${navButton("modeles", "Modèles de rapport", view, "template")}`}${currentUser.role === "ADMIN" ? `${navButton("documents", "Devis & factures", view, "documents")}${navButton("equipe", "Équipe", view, "team")}` : ""}</nav>
        <div class="profile"><strong>${escapeHtml(currentUser.nom)}</strong><br>${escapeHtml(currentUser.role)}<div class="profile-actions"><button class="icon-button install-button" data-install-app hidden>${icon("download")} Installer Intervium</button><button id="desktop-settings" class="icon-button">${icon("settings")} Paramètres</button><button id="desktop-logout" class="secondary">${icon("logout")} Déconnexion</button></div></div>
      </aside>
      <header class="mobile-header">${logoLockup("compact mobile-brand")}<div class="mobile-user"><span class="mobile-user-name">${escapeHtml(currentUser.nom)}</span><button id="mobile-settings" class="mobile-settings icon-only" aria-label="Ouvrir les paramètres" title="Paramètres">${icon("settings")}</button><button id="mobile-logout" class="mobile-logout icon-only" aria-label="Se déconnecter" title="Déconnexion">${icon("logout")}</button></div></header>
      <main class="main"><header class="topbar"><div><h1>${titleFor(view)}</h1><div class="muted">Données de ${escapeHtml(currentEntreprise?.nom || "votre entreprise")}</div></div><div class="topbar-actions"><button class="secondary icon-only" id="global-search" aria-label="Recherche globale" title="Recherche globale">${icon("search")}</button><button class="secondary notification-button icon-only" id="open-notifications" aria-label="Notifications" title="Notifications">${icon("alert")}<span id="notification-count" class="notification-count hidden">0</span></button>${adminButtonFor(view)}</div></header><div id="view">${renderView(view)}</div></main>
      <nav class="bottom-nav" aria-label="Navigation principale" data-mobile-nav>${mobileNavigation}</nav>
    </div><div id="modal-root"></div>`;

    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => navigateTo(button.dataset.view)));
    document.querySelectorAll("[data-install-app]").forEach((button) => button.addEventListener("click", installIntervium));
    document.getElementById("desktop-logout").addEventListener("click", logout);
    document.getElementById("mobile-logout").addEventListener("click", logout);
    document.getElementById("desktop-settings").addEventListener("click", openSettings);
    document.getElementById("mobile-settings").addEventListener("click", openSettings);
    document.getElementById("mobile-more")?.addEventListener("click", openMoreMenu);
    document.getElementById("global-search")?.addEventListener("click", openGlobalSearch);
    document.getElementById("open-notifications")?.addEventListener("click", openNotifications);
    bindMainActions(view);
    bindMobileNavigationReorder();
    updateInstallUi();
    refreshNotificationCount();
}

function navButton(view, label, active, iconName) { return `<button data-view="${view}" class="${view === active ? "active" : ""}">${icon(iconName)}<span>${label}</span></button>`; }
function mobileNavButton(view, iconName, label, active) { return `<button data-view="${view}" data-mobile-nav-item class="${view === active ? "active" : ""}" aria-label="${label}" title="${label}"><span class="nav-icon">${icon(iconName)}</span><span class="nav-label">${label}</span></button>`; }

function mobileNavigationItems() {
    const items = [
        { view: "dashboard", icon: "home", label: "Accueil" },
        { view: "interventions", icon: "interventions", label: currentUser.role === "CLIENT" ? "Rapports" : "Missions" },
    ];
    if (currentUser.role !== "CLIENT") items.push(
        { view: "planning", icon: "calendar", label: "Planning" },
        { view: "clients", icon: "clients", label: "Clients" },
        { view: "equipements", icon: "equipment", label: "Équipements" },
        { view: "modeles", icon: "template", label: "Modèles" },
    );
    if (currentUser.role === "ADMIN") items.push(
        { view: "documents", icon: "documents", label: "Documents" },
        { view: "equipe", icon: "team", label: "Équipe" },
        { view: "activity", icon: "history", label: "Historique" },
    );
    return items;
}

function mobileNavStorageKey() { return `intervium_mobile_nav:${currentEntreprise?.id || currentUser?.entreprise_id}:${currentUser?.id}`; }
function orderedMobileNavigationItems() {
    const available = mobileNavigationItems();
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(mobileNavStorageKey()) || "[]"); } catch {}
    const rank = new Map(saved.map((view, index) => [view, index]));
    return [...available].sort((left, right) => (rank.get(left.view) ?? 999) - (rank.get(right.view) ?? 999) || available.indexOf(left) - available.indexOf(right));
}
function renderMobileNavigation(active) {
    const ordered = orderedMobileNavigationItems();
    const visibleCount = currentUser.role === "CLIENT" ? ordered.length : 4;
    const visible = ordered.slice(0, visibleCount);
    const buttons = visible.map((item) => mobileNavButton(item.view, item.icon, item.label, active)).join("");
    return `${buttons}${ordered.length > visibleCount ? `<button id="mobile-more" aria-label="Plus de rubriques" title="Plus"><span class="nav-icon">${icon("more")}</span><span class="nav-label">Plus</span></button>` : ""}`;
}

function saveMobileNavigationOrder(nav) {
    const visible = [...nav.querySelectorAll("[data-mobile-nav-item]")].map((button) => button.dataset.view);
    const remainder = orderedMobileNavigationItems().map((item) => item.view).filter((view) => !visible.includes(view));
    try { localStorage.setItem(mobileNavStorageKey(), JSON.stringify([...visible, ...remainder])); } catch {}
}

function bindMobileNavigationReorder() {
    const nav = document.querySelector("[data-mobile-nav]");
    if (!nav || !window.matchMedia("(max-width: 768px)").matches) return;
    if (nav.dataset.dragBound === "true") return;
    nav.dataset.dragBound = "true";
    let dragged = null;
    let startX = 0, startY = 0, latestX = 0;
    let suppressClick = false;
    let activePointerId = null;
    let placeholder = null;
    let dragOffsetX = 0;
    let initialOrder = [];
    let originalNextSibling = null;
    let frame = null;
    const cancelPending = () => { clearTimeout(mobileNavLongPressTimer); mobileNavLongPressTimer = null; };
    const visibleOrder = () => [...nav.querySelectorAll("[data-mobile-nav-item]")].map((item) => item.dataset.view);
    const resetFloatingStyles = () => {
        if (!dragged) return;
        for (const property of ["left", "top", "width", "height"]) dragged.style.removeProperty(property);
        dragged.classList.remove("is-lifted");
        nav.classList.remove("is-reordering");
    };
    const placeAtOriginalPosition = () => {
        if (!dragged || !placeholder) return;
        if (originalNextSibling?.isConnected && originalNextSibling.parentElement === nav) nav.insertBefore(placeholder, originalNextSibling);
        else nav.insertBefore(placeholder, nav.querySelector("#mobile-more"));
    };
    const finish = ({ commit = true } = {}) => {
        cancelPending();
        if (!dragged) return;
        if (frame) cancelAnimationFrame(frame);
        if (!commit) placeAtOriginalPosition();
        const floatingBox = dragged.getBoundingClientRect();
        placeholder.replaceWith(dragged);
        resetFloatingStyles();
        const finalBox = dragged.getBoundingClientRect();
        const changed = commit && visibleOrder().join("|") !== initialOrder.join("|");
        dragged.animate?.([
            { transform: `translate(${floatingBox.left - finalBox.left}px, ${floatingBox.top - finalBox.top}px) scale(1.1)`, boxShadow: "0 12px 28px #0f172a35" },
            { transform: "translate(0, 0) scale(1)", boxShadow: "none" },
        ], { duration: 210, easing: "cubic-bezier(.2,.8,.2,1)" });
        if (changed) {
            saveMobileNavigationOrder(nav);
            toast("Ordre de navigation enregistré.");
        }
        dragged = null; placeholder = null; activePointerId = null; originalNextSibling = null; initialOrder = [];
        setTimeout(() => { suppressClick = false; }, 320);
    };
    const updateDragFrame = () => {
        frame = null;
        if (!dragged || !placeholder) return;
        const navBox = nav.getBoundingClientRect();
        const width = Number.parseFloat(dragged.style.width) || dragged.getBoundingClientRect().width;
        dragged.style.left = `${Math.max(navBox.left, Math.min(latestX - dragOffsetX, navBox.right - width))}px`;
        // Les rectangles sont relus à chaque frame, après toute mutation précédente du DOM.
        const candidates = [...nav.children].filter((item) =>
            item.matches?.("[data-mobile-nav-item]") && item !== dragged && !item.hidden
        );
        let targetIndex = candidates.length;
        for (let index = 0; index < candidates.length; index += 1) {
            const rect = candidates[index].getBoundingClientRect();
            if (latestX < rect.left + rect.width / 2) { targetIndex = index; break; }
        }
        const currentIndex = [...nav.children].filter((item) => item === placeholder || candidates.includes(item)).indexOf(placeholder);
        if (targetIndex === currentIndex) return;
        const targetElement = candidates[targetIndex] || nav.querySelector("#mobile-more");
        if (targetElement) nav.insertBefore(placeholder, targetElement);
        else nav.appendChild(placeholder);
    };
    nav.addEventListener("pointerdown", (event) => {
            const button = event.target.closest("[data-mobile-nav-item]");
            if (!button || button.parentElement !== nav || (event.pointerType === "mouse" && event.button !== 0)) return;
            cancelPending();
            startX = latestX = event.clientX; startY = event.clientY;
            activePointerId = event.pointerId;
            mobileNavLongPressTimer = setTimeout(() => {
                if (!button.isConnected || button.parentElement !== nav) return;
                dragged = button; suppressClick = true;
                const box = button.getBoundingClientRect();
                initialOrder = visibleOrder();
                originalNextSibling = button.nextSibling;
                dragOffsetX = event.clientX - box.left;
                placeholder = document.createElement("span"); placeholder.className = "nav-placeholder"; placeholder.setAttribute("aria-hidden", "true");
                button.before(placeholder);
                nav.classList.add("is-reordering"); button.classList.add("is-lifted");
                Object.assign(button.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
                try {
                    button.setPointerCapture?.(event.pointerId);
                } catch (error) {
                    console.warn("[mobile-nav-drag] pointer capture failed", error);
                }
                navigator.vibrate?.(35);
            }, 450);
    });
    nav.addEventListener("pointermove", (event) => {
            if (event.pointerId !== activePointerId) return;
            latestX = event.clientX;
            if (!dragged) {
                const dx = event.clientX - startX; const dy = event.clientY - startY;
                const distance = Math.hypot(dx, dy);
                if (distance >= 12) cancelPending();
                return;
            }
            if (Math.abs(event.clientY - startY) > 52) return finish({ commit: false });
            event.preventDefault();
            if (!frame) frame = requestAnimationFrame(updateDragFrame);
    });
    nav.addEventListener("pointerup", (event) => { if (event.pointerId === activePointerId) finish({ commit: true }); });
    nav.addEventListener("pointercancel", (event) => { if (event.pointerId === activePointerId) { if (dragged) finish({ commit: false }); else cancelPending(); } });
    nav.addEventListener("contextmenu", (event) => { if (event.target.closest("[data-mobile-nav-item]")) event.preventDefault(); });
    nav.addEventListener("click", (event) => { if (suppressClick && event.target.closest("[data-mobile-nav-item]")) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
}
function titleFor(view) { return ({ dashboard: "Tableau de bord", interventions: "Rapports", planning: "Planning", clients: "Clients", equipements: "Équipements", modeles: "Modèles de rapport", documents: "Devis & factures", equipe: "Équipe", activity: "Historique d’activité" })[view] || "Intervium"; }
function adminButtonFor(view) {
    const canAdd = currentUser.role === "ADMIN" ||
        (currentUser.role === "TECHNICIEN" && ["interventions", "planning"].includes(view));
    if (!canAdd || view === "dashboard") return "";
    if (view === "modeles" && currentUser.role !== "ADMIN") return "";
    if (view === "documents" && currentUser.role !== "ADMIN") return "";
    return `<button class="primary" id="add-${view}">${icon("plus")} Ajouter</button>`;
}

function renderView(view) {
    if (view === "dashboard") return renderDashboard();
    if (view === "interventions") return renderInterventions();
    if (view === "planning") return renderPlanning();
    if (view === "clients") return renderClients();
    if (view === "equipements") return renderEquipements();
    if (view === "modeles") return renderTemplates();
    if (view === "documents") return renderDocuments();
    if (view === "activity") return `<section class="panel"><div class="table-tools"><select id="activity-type"><option value="">Toutes les ressources</option><option value="client">Clients</option><option value="equipement">Équipements</option><option value="intervention">Interventions</option><option value="document">Documents</option><option value="modele">Modèles</option><option value="utilisateur">Utilisateurs</option></select><button class="secondary" id="activity-refresh">Actualiser</button></div><div id="activity-list" class="activity-list"><div class="empty"><span class="spinner"></span> Chargement…</div></div></section>`;
    return renderTeam();
}

function renderDashboard() {
    const finished = interventions.filter((item) => item.statut === "TERMINEE").length;
    const quickActions = currentUser.role === "CLIENT" ? "" : `<section class="quick-actions"><button class="primary" data-quick-action="intervention">${icon("plus")} Nouvelle intervention</button><button class="secondary" data-quick-view="planning">${icon("calendar")} Ouvrir le planning</button><button class="secondary" data-quick-view="modeles">${icon("template")} Modèles de rapport</button>${currentUser.role === "ADMIN" ? `<button class="secondary" data-quick-view="documents">${icon("documents")} Devis et factures</button>` : ""}</section>`;
    return `<section class="stats"><div class="stat"><span class="muted">Interventions</span><strong>${interventions.length}</strong></div><div class="stat"><span class="muted">Terminées</span><strong>${finished}</strong></div><div class="stat"><span class="muted">Clients</span><strong>${clients.length}</strong></div><div class="stat"><span class="muted">Équipements</span><strong>${equipements.length}</strong></div></section>${quickActions}<section class="panel"><div class="panel-head"><h2>Prochaines interventions</h2></div>${interventionTable(interventions.slice(0, 5), false)}</section>`;
}

function renderInterventions() { return `<section class="panel">${interventionTable(interventions, true)}</section>`; }

function renderPlanning() {
    const year = planningCursor.getFullYear();
    const month = planningCursor.getMonth();
    const firstMondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const start = new Date(year, month, 1 - firstMondayOffset);
    const todayKey = localDateKey(new Date());
    const cells = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        const key = localDateKey(date);
        const events = interventions.filter((item) => String(item.date_intervention || "").slice(0, 10) === key);
        return `<div class="calendar-day ${date.getMonth() === month ? "" : "outside"} ${key === todayKey ? "today" : ""}"><span class="calendar-number">${date.getDate()}</span>${events.map((event) => `<button class="calendar-event" data-edit-intervention="${event.id}" title="${escapeHtml(event.titre)} — ${escapeHtml(event.client_nom)}">${escapeHtml(event.heure?.slice(0,5) || "")} ${escapeHtml(event.titre)}</button>`).join("")}</div>`;
    }).join("");
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(planningCursor);
    return `<section class="panel"><div class="calendar-head"><button class="secondary" id="planning-prev" aria-label="Mois précédent">‹</button><h2>${capitalize(monthLabel)}</h2><button class="secondary" id="planning-next" aria-label="Mois suivant">›</button></div><div class="calendar-grid">${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${cells}</div></section>`;
}

function renderTemplates() {
    if (!reportTemplates.length) return `<section class="panel"><div class="empty">Aucun modèle de rapport. Un ADMIN peut créer une structure réutilisable.</div></section>`;
    return `<section class="panel"><div class="panel-head"><div><h2>Modèles réutilisables</h2><p class="muted">Les champs du modèle apparaissent lors de la création et dans le PDF du rapport.</p></div></div><div class="template-list">${reportTemplates.map((template) => `<article class="template-card"><div><strong>${escapeHtml(template.nom)}</strong><div class="muted">${escapeHtml(template.description || "Sans description")} · ${(template.sections || []).length} bloc(s)</div></div>${currentUser.role === "ADMIN" ? `<div class="actions"><button class="secondary" data-edit-template="${template.id}">${icon("edit")} Configurer</button><button class="danger" data-delete-template="${template.id}">${icon("trash")} Supprimer définitivement</button></div>` : ""}</article>`).join("")}</div></section>`;
}

function renderDocuments() {
    const total = commercialDocuments.reduce((sum, document) => sum + Number(document.total_ttc || 0), 0);
    const paid = commercialDocuments.filter((document) => document.statut === "PAYE").reduce((sum, document) => sum + Number(document.total_ttc || 0), 0);
    return `<section class="stats"><div class="stat"><span class="muted">Documents</span><strong>${commercialDocuments.length}</strong></div><div class="stat"><span class="muted">Total TTC</span><strong>${formatMoney(total)}</strong></div><div class="stat"><span class="muted">Payé</span><strong>${formatMoney(paid)}</strong></div><div class="stat"><span class="muted">À encaisser</span><strong>${formatMoney(total - paid)}</strong></div></section><section class="panel"><div class="document-list">${commercialDocuments.length ? commercialDocuments.map((document) => `<article class="document-card"><div><strong>${escapeHtml(document.numero || document.type)}</strong><div class="muted">${escapeHtml(document.client_nom)} · ${formatDate(document.date_emission)} · ${escapeHtml(document.statut)}</div></div><div class="actions"><strong>${formatMoney(document.total_ttc, document.devise)}</strong><button class="secondary" data-open-document="${document.id}">${icon("documents")} Voir</button><button class="danger" data-delete-document="${document.id}">${icon("trash")} Supprimer</button></div></article>`).join("") : `<div class="empty">Aucun devis ou facture.</div>`}</div></section>`;
}
function interventionTable(items, actions) {
    if (!items.length) return `<div class="empty">Aucun rapport.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Équipement</th><th>Intervention</th><th>Technicien</th><th>Statut</th>${actions ? "<th>Actions</th>" : ""}</tr></thead><tbody>${items.map((item) => `<tr><td data-label="Date">${formatDate(item.date_intervention)} ${escapeHtml(item.heure?.slice(0,5) || "")}</td><td data-label="Client">${escapeHtml(item.client_nom)}</td><td data-label="Équipement">${escapeHtml(equipmentLabel(item))}</td><td data-label="Intervention">${escapeHtml(item.titre)}</td><td data-label="Technicien">${escapeHtml(item.technicien_nom || "Non assigné")}</td><td data-label="Statut"><span class="badge">${statusLabel(item.statut)}</span></td>${actions ? `<td data-label="Actions" class="actions"><button class="secondary" data-edit-intervention="${item.id}">${icon("edit")} Ouvrir</button>${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-intervention="${item.id}">${icon("trash")} Supprimer</button>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function renderClients() {
    if (!clients.length) return `<section class="panel"><div class="empty">Aucun client.</div></section>`;
    return `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th></th></tr></thead><tbody>${clients.map((c) => `<tr><td data-label="Nom"><strong>${escapeHtml(c.nom)}</strong></td><td data-label="Email">${escapeHtml(c.email || "—")}</td><td data-label="Téléphone">${escapeHtml(c.telephone || "—")}</td><td data-label="Adresse">${escapeHtml(c.adresse || "—")}</td><td data-label="Actions" class="actions"><button class="secondary" data-open-client="${c.id}">Ouvrir</button>${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-client="${c.id}">Supprimer</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderEquipements() {
    if (!equipements.length) return `<section class="panel"><div class="empty">Aucun équipement.</div></section>`;
    return `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Client</th><th>Type</th><th>Marque / modèle</th><th>N° série</th><th></th></tr></thead><tbody>${equipements.map((e) => `<tr><td data-label="Client">${escapeHtml(e.client_nom)}</td><td data-label="Type">${escapeHtml(e.type || "—")}</td><td data-label="Marque / modèle">${escapeHtml([e.marque, e.modele].filter(Boolean).join(" · ") || "—")}</td><td data-label="N° série">${escapeHtml(e.numero_serie || "—")}</td><td data-label="Actions">${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-equipment="${e.id}">Supprimer</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderTeam() {
    if (!technicians.length) {
        return `<section class="panel"><div class="empty">Aucun technicien. Utilisez “Ajouter” pour créer le premier compte.</div></section>`;
    }
    return `<section class="panel"><div class="panel-head"><div><h2>Collaborateurs techniques</h2><p class="muted">La désactivation conserve le compte. La suppression définitive efface le technicien de la base et désassigne ses interventions.</p></div></div><div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead><tbody>${technicians.map((user) => `<tr><td data-label="Nom"><strong>${escapeHtml(user.nom)}</strong></td><td data-label="Email">${escapeHtml(user.email)}</td><td data-label="Statut"><span class="badge ${user.actif ? "" : "off"}">${user.actif ? "Actif" : "Désactivé"}</span></td><td data-label="Créé le">${formatDate(user.created_at)}</td><td data-label="Actions" class="actions">${user.actif ? `<button class="secondary" data-disable-technician="${user.id}">Désactiver</button>` : `<button class="primary" data-enable-technician="${user.id}">Réactiver</button>`}<button class="danger" data-delete-technician="${user.id}" data-technician-name="${escapeHtml(user.nom)}">Supprimer définitivement</button></td></tr>`).join("")}</tbody></table></div></section>`;
}

function bindMainActions(view) {
    document.getElementById(`add-${view}`)?.addEventListener("click", () => {
        if (view === "interventions") openNewIntervention();
        if (view === "planning") openNewIntervention();
        if (view === "clients") openNewClient();
        if (view === "equipements") openNewEquipment();
        if (view === "equipe") openNewTechnician();
        if (view === "modeles") openTemplateEditor();
        if (view === "documents") openDocumentEditor();
    });
    document.querySelectorAll("[data-quick-view]").forEach((button) => button.addEventListener("click", () => navigateTo(button.dataset.quickView)));
    document.querySelector("[data-quick-action='intervention']")?.addEventListener("click", openNewIntervention);
    document.getElementById("planning-prev")?.addEventListener("click", () => { planningCursor = new Date(planningCursor.getFullYear(), planningCursor.getMonth() - 1, 1); renderMain("planning"); });
    document.getElementById("planning-next")?.addEventListener("click", () => { planningCursor = new Date(planningCursor.getFullYear(), planningCursor.getMonth() + 1, 1); renderMain("planning"); });
    document.querySelectorAll("[data-edit-intervention]").forEach((b) => b.addEventListener("click", () => openIntervention(b.dataset.editIntervention)));
    document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => openTemplateEditor(button.dataset.editTemplate)));
    document.querySelectorAll("[data-delete-template]").forEach((button) => button.addEventListener("click", () => deleteTemplate(button.dataset.deleteTemplate, button)));
    document.querySelectorAll("[data-open-document]").forEach((button) => button.addEventListener("click", () => openDocumentDetails(button.dataset.openDocument)));
    document.querySelectorAll("[data-open-client]").forEach((button) => button.addEventListener("click", () => openClientDetails(button.dataset.openClient)));
    document.querySelectorAll("[data-delete-document]").forEach((button) => button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument, button)));
    bindDeletes("intervention", "/interventions", "interventions");
    bindDeletes("client", "/clients", "clients");
    bindDeletes("equipment", "/equipements", "equipements");
    bindTeamActions();
    if (view === "activity") bindActivityView();
    enhanceBusinessTables(view);
}

function enhanceBusinessTables(view) {
    document.querySelectorAll("#view .table-wrap").forEach((wrap, tableIndex) => {
        const table = wrap.querySelector("table");
        const rows = [...table?.tBodies?.[0]?.rows || []];
        if (!table || rows.length < 2 || wrap.dataset.enhanced) return;
        wrap.dataset.enhanced = "true";
        const storageKey = `intervium_table:${view}:${tableIndex}`;
        let saved = {}; try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); } catch {}
        let page = 1; const pageSize = 10; let sortIndex = Number.isInteger(saved.sortIndex) ? saved.sortIndex : -1; let direction = saved.direction || "asc";
        const tools = document.createElement("div"); tools.className = "table-tools";
        tools.innerHTML = `<label class="sr-only" for="table-search-${tableIndex}">Filtrer ce tableau</label><input id="table-search-${tableIndex}" type="search" placeholder="Filtrer cette liste…" value="${escapeHtml(saved.query || "")}"><button class="secondary" type="button">Réinitialiser</button>`;
        wrap.before(tools);
        const pager = document.createElement("div"); pager.className = "pagination"; wrap.after(pager);
        const search = tools.querySelector("input");
        const render = () => {
            const query = search.value.trim().toLocaleLowerCase("fr");
            let filtered = rows.filter((row) => row.textContent.toLocaleLowerCase("fr").includes(query));
            if (sortIndex >= 0) filtered.sort((a, b) => a.cells[sortIndex].textContent.trim().localeCompare(b.cells[sortIndex].textContent.trim(), "fr", { numeric: true }) * (direction === "asc" ? 1 : -1));
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, pages);
            rows.forEach((row) => { row.hidden = true; }); filtered.slice((page - 1) * pageSize, page * pageSize).forEach((row) => { row.hidden = false; row.parentElement.append(row); });
            pager.innerHTML = `<button class="secondary" type="button" data-page="prev" ${page === 1 ? "disabled" : ""}>Précédent</button><span>${filtered.length ? `${filtered.length} résultat(s) · page ${page}/${pages}` : "Aucun résultat"}</span><button class="secondary" type="button" data-page="next" ${page === pages ? "disabled" : ""}>Suivant</button>`;
            pager.querySelector('[data-page="prev"]')?.addEventListener("click", () => { page -= 1; render(); }); pager.querySelector('[data-page="next"]')?.addEventListener("click", () => { page += 1; render(); });
            try { sessionStorage.setItem(storageKey, JSON.stringify({ query: search.value, sortIndex, direction })); } catch {}
        };
        let timer; search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; render(); }, 250); });
        tools.querySelector("button").addEventListener("click", () => { search.value = ""; sortIndex = -1; page = 1; render(); });
        [...table.tHead?.rows?.[0]?.cells || []].forEach((header, index) => { if (/actions?/i.test(header.textContent)) return; header.tabIndex = 0; header.title = "Trier cette colonne"; header.addEventListener("click", () => { direction = sortIndex === index && direction === "asc" ? "desc" : "asc"; sortIndex = index; page = 1; render(); }); header.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); header.click(); } }); });
        render();
    });
}

async function bindActivityView(page = 1) {
    const type = document.getElementById("activity-type")?.value || "";
    try {
        const result = await api(`/activity?page=${page}&limit=25${type ? `&type=${encodeURIComponent(type)}` : ""}`);
        const list = document.getElementById("activity-list"); if (!list) return;
        list.innerHTML = result.items.length ? result.items.map((item) => `<article class="activity-item"><span><strong>${escapeHtml(item.resume)}</strong><small>${escapeHtml(item.utilisateur_nom || "Utilisateur supprimé")} · ${escapeHtml(item.utilisateur_role || "—")} · ${new Date(item.created_at).toLocaleString("fr-FR")}</small></span><span class="badge">${escapeHtml(item.ressource_type)}</span></article>`).join("") + `<div class="pagination"><button class="secondary" data-activity-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Précédent</button><span>Page ${page} / ${Math.max(1, result.pagination.pages)}</span><button class="secondary" data-activity-page="${page + 1}" ${page >= result.pagination.pages ? "disabled" : ""}>Suivant</button></div>` : `<div class="empty">Aucune activité enregistrée.</div>`;
        list.querySelectorAll("[data-activity-page]").forEach((button) => button.addEventListener("click", () => bindActivityView(Number(button.dataset.activityPage))));
    } catch (error) { document.getElementById("activity-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
    document.getElementById("activity-type")?.addEventListener("change", () => bindActivityView(1), { once: true });
    document.getElementById("activity-refresh")?.addEventListener("click", () => bindActivityView(page), { once: true });
}

function openMoreMenu() {
    const visible = new Set([...document.querySelectorAll("[data-mobile-nav-item]")].map((button) => button.dataset.view));
    const items = orderedMobileNavigationItems().filter((item) => !visible.has(item.view));
    modal("Plus de rubriques", `<div class="more-menu">${items.map((item) => `<button class="secondary" data-more-view="${item.view}">${icon(item.icon)} ${item.label}</button>`).join("")}</div><p class="muted">Maintenez une icône de la barre inférieure pour réorganiser vos raccourcis.</p><button class="secondary wide" id="customize-nav-from-more" type="button">Personnaliser la navigation</button>`);
    document.querySelectorAll("[data-more-view]").forEach((button) => button.addEventListener("click", () => navigateTo(button.dataset.moreView)));
    document.getElementById("customize-nav-from-more")?.addEventListener("click", openMobileNavigationCustomizer);
}

function openGlobalSearch() {
    modal("Recherche globale", `<div class="field"><label for="global-search-input">Rechercher dans votre espace</label><input id="global-search-input" type="search" autocomplete="off" placeholder="Client, équipement, intervention, document…"></div><div id="global-search-results" class="search-results"><div class="empty">Saisissez au moins 2 caractères.</div></div>`);
    const input = document.getElementById("global-search-input");
    input.addEventListener("input", () => {
        clearTimeout(globalSearchTimer);
        const query = input.value.trim();
        if (query.length < 2) { document.getElementById("global-search-results").innerHTML = `<div class="empty">Saisissez au moins 2 caractères.</div>`; return; }
        document.getElementById("global-search-results").innerHTML = `<div class="empty"><span class="spinner"></span> Recherche…</div>`;
        globalSearchTimer = setTimeout(async () => {
            try {
                const result = await api(`/search?q=${encodeURIComponent(query)}`);
                const target = document.getElementById("global-search-results");
                if (!target) return;
                target.innerHTML = result.items.length ? result.items.map((item) => `<button class="search-result" data-search-type="${escapeHtml(item.type)}" data-search-id="${item.id}"><span><strong>${escapeHtml(item.titre)}</strong><small>${escapeHtml(item.sous_titre || item.type)}</small></span><span class="badge">${escapeHtml(item.type)}</span></button>`).join("") : `<div class="empty">Aucun résultat.</div>`;
                target.querySelectorAll("[data-search-type]").forEach((button) => button.addEventListener("click", () => openSearchResult(button.dataset.searchType, button.dataset.searchId)));
            } catch (error) { document.getElementById("global-search-results").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
        }, 350);
    });
}

function openSearchResult(type, id) {
    closeModal();
    if (["intervention", "rapport"].includes(type)) { navigateTo("interventions"); return setTimeout(() => openIntervention(id), 0); }
    if (type === "client") { navigateTo("clients"); return setTimeout(() => openClientDetails(id), 0); }
    if (["devis", "facture"].includes(type)) { navigateTo("documents"); return setTimeout(() => openDocumentDetails(id), 0); }
    navigateTo("equipements");
}

async function refreshNotificationCount() {
    try {
        const result = await api("/notifications?limit=10&unread=true");
        const badge = document.getElementById("notification-count");
        if (!badge) return;
        badge.textContent = result.unread > 99 ? "99+" : String(result.unread);
        badge.classList.toggle("hidden", !result.unread);
    } catch { /* Le centre reste discret si la migration n'est pas encore déployée. */ }
}

async function openNotifications() {
    modal("Notifications", `<div class="panel-head"><label><input id="notifications-unread" type="checkbox"> Non lues uniquement</label><button class="secondary" id="read-all-notifications">Tout marquer comme lu</button></div><div id="notifications-list" class="notification-list"><div class="empty"><span class="spinner"></span> Chargement…</div></div>`);
    const load = async () => {
        try {
            const unread = document.getElementById("notifications-unread")?.checked;
            const result = await api(`/notifications?limit=30${unread ? "&unread=true" : ""}`);
            const list = document.getElementById("notifications-list");
            if (!list) return;
            list.innerHTML = result.items.length ? result.items.map((item) => `<button class="notification-item ${item.lu_at ? "" : "unread"}" data-notification-id="${item.id}" data-resource-type="${escapeHtml(item.ressource_type || "")}" data-resource-id="${item.ressource_id || ""}"><span><strong>${escapeHtml(item.titre)}</strong><small>${escapeHtml(item.message)}</small><small>${new Date(item.created_at).toLocaleString("fr-FR")}</small></span></button>`).join("") : `<div class="empty">Aucune notification.</div>`;
            list.querySelectorAll("[data-notification-id]").forEach((button) => button.addEventListener("click", async () => { await api(`/notifications/${button.dataset.notificationId}/read`, { method: "PATCH" }); openSearchResult(button.dataset.resourceType, button.dataset.resourceId); }));
            refreshNotificationCount();
        } catch (error) { document.getElementById("notifications-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
    };
    document.getElementById("notifications-unread").addEventListener("change", load);
    document.getElementById("read-all-notifications").addEventListener("click", async () => { await api("/notifications/read-all", { method: "POST" }); await load(); });
    await load();
}

function bindDeletes(name, path, view) {
    document.querySelectorAll(`[data-delete-${name}]`).forEach((button) => button.addEventListener("click", async () => {
        if (!confirm("Confirmer la suppression ?")) return;
        await withBusy(button, async () => {
            try {
                await api(`${path}/${button.dataset[`delete${capitalize(name)}`]}`, { method: "DELETE" });
                await finishMutation(view, "Suppression effectuée.");
            } catch (error) { toast(error.message, true); }
        });
    }));
}

function modal(title, content) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal-head"><h2 id="modal-title">${escapeHtml(title)}</h2><button class="close icon-only" id="close-modal" type="button" aria-label="Fermer" title="Fermer">${icon("close")}</button></header>${content}</section></div>`;
    const dialog = root.querySelector(".modal");
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')];
    const keyHandler = (event) => {
        if (event.key === "Escape") return closeModal();
        if (event.key !== "Tab") return;
        const items = focusable(); if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    root._keyHandler = keyHandler;
    document.addEventListener("keydown", keyHandler);
    root.querySelector(".modal-backdrop").addEventListener("mousedown", (event) => { if (event.target.classList.contains("modal-backdrop")) closeModal(); });
    document.getElementById("close-modal").addEventListener("click", closeModal);
    requestAnimationFrame(() => (focusable()[0] || dialog).focus());
}
function closeModal() { closeTemplateSectionDrawer(); const root = document.getElementById("modal-root"); if (root?._keyHandler) document.removeEventListener("keydown", root._keyHandler); if (root) root.innerHTML = ""; }

function openSettings() {
    const activeTheme = document.documentElement.dataset.theme || "classic";
    const reportSettings = currentEntreprise?.report_settings || {};
    const pwaSettings = isStandaloneMode()
        ? `<div class="pwa-help"><strong>Intervium est installée</strong><p>L'application fonctionne actuellement en mode autonome.</p></div>`
        : isIosDevice()
          ? `<div class="pwa-help"><strong>Installer sur iPhone ou iPad</strong><p>Dans Safari, touchez Partager puis « Ajouter à l'écran d'accueil ».</p></div>`
          : `<div class="pwa-help"><strong>Application installable</strong><p>Installez Intervium pour l'ouvrir comme une application.</p><button class="primary install-button" type="button" data-install-app hidden>Installer Intervium</button></div>`;
    const companySettings = currentUser.role === "ADMIN" ? `
        <form id="company-report-settings" class="company-branding">
          <div class="panel-head"><div><h2>Identité des rapports PDF</h2><p class="muted">Ces informations remplacent entièrement la marque Intervium dans vos documents.</p></div></div>
          <div class="company-logo-preview">${currentEntreprise?.logo_url ? `<img src="${escapeHtml(currentEntreprise.logo_url)}" alt="Logo actuel de l’entreprise">` : `<span class="muted">Aucun logo d’entreprise</span>`}</div>
          ${fileUpload({ id: "company-logo-file", name: "logo", label: "Logo de l’entreprise", help: "PNG, JPEG ou WebP", accept: "image/png,image/jpeg,image/webp", maxMb: 5 })}
          ${currentEntreprise?.logo_url ? `<button class="danger" id="remove-company-logo" type="button">${icon("trash")} Supprimer le logo actuel</button>` : ""}
          <div class="grid2"><div class="field"><label>Nom affiché</label><input name="display_name" maxlength="150" required value="${escapeHtml(reportSettings.display_name || currentEntreprise?.nom || "")}"></div><div class="field"><label>Identifiant légal / SIRET</label><input name="registration" maxlength="120" value="${escapeHtml(reportSettings.registration || "")}"></div></div>
          <div class="field"><label>Adresse</label><textarea name="address" rows="2" maxlength="300">${escapeHtml(reportSettings.address || "")}</textarea></div>
          <div class="grid2"><div class="field"><label>Téléphone</label><input name="phone" maxlength="40" value="${escapeHtml(reportSettings.phone || "")}"></div><div class="field"><label>Email</label><input name="email" type="email" maxlength="254" value="${escapeHtml(reportSettings.email || "")}"></div></div>
          <div class="field"><label>Site internet</label><input name="website" maxlength="200" placeholder="https://www.mon-entreprise.fr" value="${escapeHtml(reportSettings.website || "")}"></div>
          <div class="grid2"><div class="field color-field"><label>Couleur d’accent</label><input name="accent_color" type="color" value="${escapeHtml(reportSettings.accent_color || "#1d4ed8")}"></div><div class="field"><label>Style d’en-tête</label><select name="header_style"><option value="minimal" ${(reportSettings.header_style || "minimal") === "minimal" ? "selected" : ""}>Minimal - logo sur fond blanc</option><option value="band" ${reportSettings.header_style === "band" ? "selected" : ""}>Bandeau coloré</option><option value="none" ${reportSettings.header_style === "none" ? "selected" : ""}>Sans en-tête</option></select></div></div>
          <div class="field"><label>Texte du pied de page</label><input name="footer_text" maxlength="240" placeholder="Ex. Merci pour votre confiance" value="${escapeHtml(reportSettings.footer_text || "")}"></div>
          <div class="field"><label><input name="show_intervium" type="checkbox" ${reportSettings.show_intervium ? "checked" : ""}> Afficher discrètement « Généré avec Intervium »</label></div>
          <button class="primary wide" type="submit">Enregistrer l’identité des PDF</button>
        </form>` : "";
    modal("Paramètres", `
        <div class="settings-intro">
            <strong>Personnalisez Intervium</strong>
            <div>Choisissez l’apparence la plus confortable pour votre environnement de travail.</div>
        </div>
        <div class="theme-options" role="radiogroup" aria-label="Thème de l’application">
            <label class="theme-option"><input type="radio" name="visual-theme" value="classic" ${activeTheme === "classic" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon">${icon("sun")}</span><span>Classique</span></span></label>
            <label class="theme-option"><input type="radio" name="visual-theme" value="glass" ${activeTheme === "glass" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon">${icon("glass")}</span><span>Liquid Glass</span></span></label>
            <label class="theme-option"><input type="radio" name="visual-theme" value="dark" ${activeTheme === "dark" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon">${icon("moon")}</span><span>Sombre</span></span></label>
        </div>
        <p class="muted">Cette préférence visuelle est enregistrée uniquement sur cet appareil.</p>
        <form id="password-settings" class="settings-intro">
          <strong>Sécurité du compte</strong>
          <div class="field"><label>Mot de passe actuel</label><input name="current_password" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>Nouveau mot de passe</label><input name="new_password" type="password" minlength="8" autocomplete="new-password" required></div>
          <div class="field"><label>Confirmer le nouveau mot de passe</label><input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></div>
          <button class="secondary wide" type="submit">Modifier mon mot de passe</button>
        </form>
        <section class="settings-intro">
          <strong>Envoi des rapports avec Google</strong>
          <p>${googleMailStatus.connection ? `Compte connecté : <strong>${escapeHtml(googleMailStatus.connection.email_google)}</strong>` : "Connectez votre compte Google pour envoyer les rapports depuis votre propre adresse Gmail."}</p>
          ${googleMailStatus.connection ? '<button class="danger wide" id="disconnect-google" type="button">Déconnecter mon compte Google</button>' : `<button class="primary wide" id="connect-google" type="button" ${googleMailStatus.enabled ? "" : "disabled"}>Connecter mon compte Google</button>`}
          ${googleMailStatus.enabled ? "" : '<p class="muted">La connexion Google n’est pas configurée sur le serveur.</p>'}
        </section>
        <section class="settings-intro"><strong>Navigation mobile</strong><p>Choisissez l’ordre des raccourcis et les rubriques placées dans « Plus ».</p><button class="secondary wide" id="customize-mobile-nav" type="button">${icon("more")} Personnaliser la navigation</button></section>
        ${pwaSettings}
        ${companySettings}
        <section class="settings-intro" aria-labelledby="about-intervium"><strong id="about-intervium">À propos</strong><p>Intervium — gestion des interventions, rapports et documents métier.</p><p class="muted">Conçu par Sylvain Lecoeuvre</p></section>
    `);

    document.querySelectorAll('input[name="visual-theme"]').forEach((input) => input.addEventListener("change", (event) => {
        const theme = setTheme(event.target.value);
        toast(({ classic: "Thème classique activé.", glass: "Mode Liquid Glass activé.", dark: "Thème sombre activé." })[theme]);
    }));
    document.querySelectorAll("[data-install-app]").forEach((button) => button.addEventListener("click", installIntervium));
    document.getElementById("customize-mobile-nav")?.addEventListener("click", openMobileNavigationCustomizer);
    document.getElementById("connect-google")?.addEventListener("click", async (event) => withBusy(event.currentTarget, async () => {
        try { const result = await api("/google/authorize"); window.location.assign(result.url); }
        catch (error) { toast(error.message, true); }
    }));
    document.getElementById("disconnect-google")?.addEventListener("click", async (event) => withBusy(event.currentTarget, async () => {
        try { await api("/google/connection", { method: "DELETE" }); googleMailStatus.connection = null; openSettings(); toast("Compte Google déconnecté."); }
        catch (error) { toast(error.message, true); }
    }));
    document.getElementById("password-settings")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const values = Object.fromEntries(new FormData(form));
        if (values.new_password !== values.confirm_password) return toast("Les deux nouveaux mots de passe ne correspondent pas.", true);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                await api("/auth/password", { method: "PUT", body: JSON.stringify({ current_password: values.current_password, new_password: values.new_password }) });
                form.reset();
                toast("Mot de passe modifié.");
            } catch (error) { toast(error.message, true); }
        });
    });
    updateInstallUi();
    document.getElementById("company-report-settings")?.addEventListener("submit", saveCompanyReportSettings);
    bindFileUpload(document.querySelector("#company-logo-file")?.closest("[data-file-upload]"), { onChange: (file, component) => {
        const input = component.querySelector("input");
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            input.setCustomValidity("Utilisez une image PNG, JPEG ou WebP.");
            component.classList.add("is-error"); component.querySelector(".file-upload-status").textContent = input.validationMessage;
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            input.setCustomValidity("Le logo dépasse la limite de 5 Mo.");
            component.classList.add("is-error"); component.querySelector(".file-upload-status").textContent = input.validationMessage;
            return;
        }
        const preview = document.querySelector(".company-logo-preview");
        const objectUrl = URL.createObjectURL(file);
        preview.classList.add("logo-preview-pending");
        preview.innerHTML = `<img src="${objectUrl}" alt="Aperçu du nouveau logo"><span class="muted">Aperçu avant enregistrement</span>`;
    }});
    document.getElementById("remove-company-logo")?.addEventListener("click", (event) => withBusy(event.currentTarget, async () => {
        if (!confirm("Supprimer le logo des prochains rapports PDF ?")) return;
        try {
            const result = await api("/uploads/company-logo", { method: "DELETE" });
            currentEntreprise = result.entreprise;
            openSettings();
            toast("Logo supprimé des rapports.");
        } catch (error) { toast(error.message, true); }
    }));
}

function openMobileNavigationCustomizer() {
    const render = () => {
        const items = orderedMobileNavigationItems();
        const visibleCount = currentUser.role === "CLIENT" ? items.length : 4;
        closeModal();
        modal("Navigation mobile", `<p class="muted">Les ${visibleCount} premières rubriques apparaissent dans la barre. Les suivantes restent accessibles dans « Plus ».</p><div class="nav-customizer">${items.map((item, index) => `${index === visibleCount ? '<div class="nav-customizer-divider">Dans « Plus »</div>' : ""}<div class="nav-customizer-row ${index >= visibleCount ? "is-more" : ""}"><span>${icon(item.icon)}<strong>${escapeHtml(item.label)}</strong></span><div class="actions"><button class="secondary icon-only" type="button" data-nav-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="Monter ${escapeHtml(item.label)}" title="Monter">↑</button><button class="secondary icon-only" type="button" data-nav-down="${index}" ${index === items.length - 1 ? "disabled" : ""} aria-label="Descendre ${escapeHtml(item.label)}" title="Descendre">↓</button></div></div>`).join("")}</div><div class="actions"><button class="secondary" id="reset-mobile-navigation" type="button">Réinitialiser</button><button class="primary" id="save-mobile-navigation" type="button">Enregistrer</button></div>`);
        const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= items.length) return; [items[index], items[target]] = [items[target], items[index]]; try { localStorage.setItem(mobileNavStorageKey(), JSON.stringify(items.map((item) => item.view))); } catch {} render(); };
        document.querySelectorAll("[data-nav-up]").forEach((button) => button.addEventListener("click", () => move(Number(button.dataset.navUp), -1)));
        document.querySelectorAll("[data-nav-down]").forEach((button) => button.addEventListener("click", () => move(Number(button.dataset.navDown), 1)));
        document.getElementById("reset-mobile-navigation").addEventListener("click", () => { try { localStorage.removeItem(mobileNavStorageKey()); } catch {} render(); });
        document.getElementById("save-mobile-navigation").addEventListener("click", () => { closeModal(); renderMain(currentView); toast("Navigation mobile enregistrée."); });
    };
    render();
}

async function saveCompanyReportSettings(event) {
    event.preventDefault();
    // currentTarget n'est garanti que pendant l'exécution synchrone du listener.
    // On conserve donc le formulaire avant le premier await.
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
        toast("Le formulaire de paramètres est indisponible. Rechargez la page.", true);
        return;
    }
    const button = form.querySelector('button[type="submit"]');
    await withBusy(button, async () => {
        try {
            const logoFile = document.getElementById("company-logo-file")?.files[0];
            if (logoFile) {
                if (!["image/png", "image/jpeg", "image/webp"].includes(logoFile.type)) {
                    throw new Error("Format refusé. Utilisez une image PNG, JPEG ou WebP.");
                }
                if (logoFile.size > 5 * 1024 * 1024) {
                    throw new Error("Le logo dépasse la limite de 5 Mo.");
                }
                const logoData = new FormData();
                logoData.append("logo", logoFile);
                const logoResult = await api("/uploads/company-logo", { method: "POST", body: logoData });
                currentEntreprise = logoResult.entreprise;
            }
            const values = Object.fromEntries(new FormData(form));
            values.show_intervium = form.elements.show_intervium.checked;
            const result = await api("/auth/company", {
                method: "PUT",
                body: JSON.stringify({ report_settings: values }),
            });
            currentEntreprise = result.entreprise;
            closeModal();
            toast("Identité des rapports PDF enregistrée.");
        } catch (error) { toast(error.message, true); }
    });
}

const TEMPLATE_FIELD_TYPES = [
    ["title", "Titre"], ["text", "Texte court"], ["textarea", "Zone de texte"],
    ["date", "Date et heure"], ["number", "Numérique"], ["checkbox", "Case à cocher"],
    ["select", "Liste de choix"], ["equipment", "Équipement client"],
    ["photo", "Photo"], ["multi_photo", "Multi-photos"], ["event_photos", "Photos événement"],
    ["signature", "Signature"], ["electronic_signature", "Signature électronique"],
    ["creator", "Profil du créateur"], ["gps", "Position GPS"], ["address", "Adresse"],
    ["table", "Tableau"], ["price_table", "Tableau de prix"], ["page_break", "Saut de page"],
];
const TABLE_COLUMN_TYPES = [
    ["text", "Texte"], ["textarea", "Texte long"], ["integer", "Nombre entier"],
    ["decimal", "Nombre décimal"], ["currency", "Montant"], ["percentage", "Pourcentage"],
    ["date", "Date"], ["time", "Heure"], ["datetime", "Date et heure"],
    ["boolean", "Oui / Non"], ["checkbox", "Case à cocher"], ["select", "Liste"],
    ["photo", "Photo"], ["row_number", "N° de ligne"], ["calculated", "Calcul automatique"],
];

function normalizeTableColumn(column, index, priceTable = false) {
    const source = typeof column === "string" ? { label: column } : (column || {});
    const fallbackType = priceTable && index === 1 ? "decimal" : priceTable && index === 2 ? "currency" : priceTable && index === 3 ? "percentage" : "text";
    return {
        key: String(source.key || `c${index}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `c${index}`,
        label: String(source.label || source.name || `Colonne ${index + 1}`).slice(0, 80),
        type: TABLE_COLUMN_TYPES.some(([type]) => type === source.type) ? source.type : fallbackType,
        required: source.required === true,
        width: Math.min(12, Math.max(1, Number(source.width) || 3)),
        align: ["left", "center", "right"].includes(source.align) ? source.align : "left",
        visibleForm: source.visibleForm !== false,
        visiblePdf: source.visiblePdf !== false,
        defaultValue: source.defaultValue ?? "",
        options: Array.isArray(source.options) ? source.options.map(String).slice(0, 40) : [],
        allowOther: source.allowOther === true,
        min: source.min ?? null,
        max: source.max ?? null,
        decimals: Math.min(4, Math.max(0, Number(source.decimals) || 0)),
        unit: String(source.unit || "").slice(0, 20),
        calculation: ["sum", "multiply", "average", "count"].includes(source.calculation) ? source.calculation : "",
    };
}

function normalizeTemplateSection(section) {
    const normalized = { ...newTemplateSection(section.type, section.label, section.key), ...section };
    normalized.options = [...(section.options || [])];
    normalized.columns = (section.columns || []).map((column, index) => normalizeTableColumn(column, index, section.type === "price_table"));
    normalized.defaultRows = Array.isArray(section.defaultRows) ? structuredClone(section.defaultRows).slice(0, 30) : [];
    normalized.listMode = ["select", "radio", "checkboxes", "segments"].includes(section.listMode) ? section.listMode : "select";
    normalized.multiple = section.multiple === true;
    normalized.allowOther = section.allowOther === true;
    normalized.allowAddRows = section.allowAddRows !== false;
    normalized.minRows = Math.max(0, Number(section.minRows) || 0);
    normalized.maxRows = Math.min(100, Math.max(normalized.minRows || 1, Number(section.maxRows) || 30));
    normalized.tableMode = ["table", "rows", "cards", "compact", "detailed"].includes(section.tableMode) ? section.tableMode : "table";
    return normalized;
}

function openTemplateEditor(id = null) {
    const existing = reportTemplates.find((template) => String(template.id) === String(id));
    templateDraftSections = (existing?.sections || []).map(normalizeTemplateSection);
    modal(existing ? "Configurer le modèle" : "Nouveau modèle de rapport", `<form id="template-form">
      ${field("Nom du modèle", "template-name", "text", true, existing?.nom || "")}
      <div class="field"><label for="template-description">Description</label><textarea id="template-description" rows="2">${escapeHtml(existing?.description || "")}</textarea></div>
      <div class="builder-palette">${TEMPLATE_FIELD_TYPES.map(([type, label]) => `<button type="button" class="secondary" data-add-template-field="${type}">＋ ${label}</button>`).join("")}</div>
      <div id="template-fields" class="template-fields"></div>
      <details class="template-preview"><summary>Configuration du PDF</summary><div class="grid2"><div class="field"><label for="pdf-margin">Marges (24 à 90 pt)</label><input id="pdf-margin" type="number" min="24" max="90" value="${existing?.pdf_config?.margin || 48}"></div><div class="field"><label for="pdf-title-size">Taille du titre</label><input id="pdf-title-size" type="number" min="14" max="28" value="${existing?.pdf_config?.titleSize || 20}"></div></div><div class="checkbox-options"><label><input id="pdf-show-header" type="checkbox" ${existing?.pdf_config?.showHeader !== false ? "checked" : ""}> Afficher l’en-tête</label><label><input id="pdf-show-client" type="checkbox" ${existing?.pdf_config?.showClient !== false ? "checked" : ""}> Informations client</label><label><input id="pdf-show-equipment" type="checkbox" ${existing?.pdf_config?.showEquipment !== false ? "checked" : ""}> Équipements</label><label><input id="pdf-show-photos" type="checkbox" ${existing?.pdf_config?.showPhotos !== false ? "checked" : ""}> Photos</label><label><input id="pdf-show-signature" type="checkbox" ${existing?.pdf_config?.showSignature !== false ? "checked" : ""}> Signature</label><label><input id="pdf-show-pages" type="checkbox" ${existing?.pdf_config?.showPageNumbers !== false ? "checked" : ""}> Numéros de page</label></div><div class="field"><label for="pdf-footer">Pied de page</label><input id="pdf-footer" maxlength="240" value="${escapeHtml(existing?.pdf_config?.footerText || "")}"></div></details>
      <button class="primary wide" type="submit">${existing ? "Enregistrer le modèle" : "Créer le modèle"}</button>
    </form><details class="template-preview"><summary>Prévisualiser le formulaire</summary><div id="template-preview" inert></div></details>`);
    renderTemplateDraft();
    document.querySelectorAll("[data-add-template-field]").forEach((button) => button.addEventListener("click", () => {
        const type = button.dataset.addTemplateField;
        const defaultLabel = TEMPLATE_FIELD_TYPES.find(([value]) => value === type)?.[1] || "Champ";
        templateDraftSections.push(newTemplateSection(type, defaultLabel));
        renderTemplateDraft();
    }));
    document.getElementById("template-name").addEventListener("input", renderTemplatePreview);
    document.getElementById("template-form").addEventListener("submit", (event) => saveTemplate(event, existing));
}

function newTemplateSection(type, label, key = null) {
    return {
        key: key || `champ_${Date.now()}_${templateDraftSections.length}`,
        type,
        label,
        required: false,
        options: ["select", "checkbox"].includes(type) ? ["Oui", "Non", "Non applicable"] : [],
        columns: type === "price_table" ? ["Désignation", "Quantité", "Prix HT", "TVA %"].map((column, index) => normalizeTableColumn(column, index, true)) : type === "table" ? ["Colonne 1", "Colonne 2"].map((column, index) => normalizeTableColumn(column, index)) : [],
        defaultRows: [], allowAddRows: true, minRows: 0, maxRows: 30, tableMode: "table",
        listMode: "select", multiple: false, allowOther: false,
        placeholder: "",
        helpText: "",
        defaultValue: "",
        width: "full",
        rows: 4,
        min: null,
        max: null,
        step: 1,
        unit: "",
        dateMode: "date",
        maxPhotos: type === "photo" ? 1 : 5,
    };
}

function templateSpecificConfiguration(section, index) {
    const property = (name, value, kind = "text") => `data-template-property="${name}" data-template-index="${index}" data-value-kind="${kind}" value="${escapeHtml(value ?? "")}"`;
    const fields = [];
    if (["text", "textarea", "date", "number", "select", "address", "gps"].includes(section.type)) {
        fields.push(`<div class="field"><label>Texte indicatif</label><input ${property("placeholder", section.placeholder)} placeholder="Exemple affiché dans le champ"></div>`);
    }
    if (["text", "textarea", "date", "number", "select", "address"].includes(section.type)) {
        fields.push(`<div class="field"><label>Valeur par défaut</label><input ${property("defaultValue", section.defaultValue)}></div>`);
    }
    if (["select", "checkbox"].includes(section.type)) {
        fields.push(`<div class="field full"><label>Choix proposés (un par ligne)</label><textarea data-template-property="options" data-value-kind="lines" rows="6" placeholder="Conforme\nNon conforme\nNon applicable">${escapeHtml((section.options || []).join("\n"))}</textarea></div><div class="field"><label>Mode d’affichage</label><select data-template-property="listMode"><option value="select" ${section.listMode === "select" ? "selected" : ""}>Menu déroulant</option><option value="radio" ${section.listMode === "radio" ? "selected" : ""}>Boutons radio</option><option value="checkboxes" ${section.listMode === "checkboxes" ? "selected" : ""}>Cases à cocher</option><option value="segments" ${section.listMode === "segments" ? "selected" : ""}>Boutons segmentés</option></select></div><label class="setting-check"><input type="checkbox" data-template-property="multiple" ${section.multiple ? "checked" : ""}> Autoriser plusieurs réponses</label><label class="setting-check"><input type="checkbox" data-template-property="allowOther" ${section.allowOther ? "checked" : ""}> Ajouter le choix « Autre »</label>`);
    }
    if (section.type === "textarea") {
        fields.push(`<div class="field"><label>Nombre de lignes</label><input type="number" min="2" max="12" ${property("rows", section.rows || 4, "number")}></div>`);
    }
    if (section.type === "number") {
        fields.push(`<div class="field"><label>Minimum</label><input type="number" ${property("min", section.min, "nullable-number")}></div><div class="field"><label>Maximum</label><input type="number" ${property("max", section.max, "nullable-number")}></div><div class="field"><label>Pas</label><input type="number" min="0.001" step="0.001" ${property("step", section.step || 1, "number")}></div><div class="field"><label>Unité</label><input ${property("unit", section.unit)} placeholder="bar, °C, mm..."></div>`);
    }
    if (section.type === "date") {
        fields.push(`<div class="field"><label>Format</label><select data-template-property="dateMode" data-template-index="${index}"><option value="date" ${section.dateMode !== "datetime-local" ? "selected" : ""}>Date</option><option value="datetime-local" ${section.dateMode === "datetime-local" ? "selected" : ""}>Date et heure</option></select></div>`);
    }
    if (["table", "price_table"].includes(section.type)) {
        fields.push(`<div class="field full"><label>Colonnes du tableau</label><div class="advanced-column-list">${(section.columns || []).map((column, columnIndex) => `<article class="advanced-column" data-column-index="${columnIndex}"><div class="advanced-column-head"><strong>${escapeHtml(column.label)}</strong><span class="badge off">${escapeHtml(TABLE_COLUMN_TYPES.find(([type]) => type === column.type)?.[1] || column.type)}</span></div><div class="grid2"><div class="field"><label>Nom</label><input data-column-property="label" value="${escapeHtml(column.label)}"></div><div class="field"><label>Type</label><select data-column-property="type">${TABLE_COLUMN_TYPES.map(([type, label]) => `<option value="${type}" ${column.type === type ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label>Largeur (1–12)</label><input type="number" min="1" max="12" data-column-property="width" value="${column.width}"></div><div class="field"><label>Alignement</label><select data-column-property="align"><option value="left" ${column.align === "left" ? "selected" : ""}>Gauche</option><option value="center" ${column.align === "center" ? "selected" : ""}>Centre</option><option value="right" ${column.align === "right" ? "selected" : ""}>Droite</option></select></div><div class="field"><label>Calcul de synthèse</label><select data-column-property="calculation"><option value="">Aucun</option><option value="sum" ${column.calculation === "sum" ? "selected" : ""}>Somme</option><option value="average" ${column.calculation === "average" ? "selected" : ""}>Moyenne</option><option value="count" ${column.calculation === "count" ? "selected" : ""}>Comptage</option></select></div><div class="field"><label>Valeur par défaut</label><input data-column-property="defaultValue" value="${escapeHtml(column.defaultValue ?? "")}"></div></div>${column.type === "select" ? `<div class="field"><label>Choix de la colonne (un par ligne)</label><textarea data-column-property="options" data-value-kind="lines" rows="4">${escapeHtml((column.options || []).join("\n"))}</textarea></div>` : ""}${["integer", "decimal", "currency", "percentage"].includes(column.type) ? `<div class="grid2"><div class="field"><label>Minimum</label><input type="number" data-column-property="min" value="${column.min ?? ""}"></div><div class="field"><label>Maximum</label><input type="number" data-column-property="max" value="${column.max ?? ""}"></div><div class="field"><label>Décimales</label><input type="number" min="0" max="4" data-column-property="decimals" value="${column.decimals || 0}"></div><div class="field"><label>Unité / suffixe</label><input data-column-property="unit" value="${escapeHtml(column.unit || "")}"></div></div>` : ""}<div class="actions"><label><input type="checkbox" data-column-property="required" ${column.required ? "checked" : ""}> Obligatoire</label><label><input type="checkbox" data-column-property="visibleForm" ${column.visibleForm !== false ? "checked" : ""}> Formulaire</label><label><input type="checkbox" data-column-property="visiblePdf" ${column.visiblePdf !== false ? "checked" : ""}> PDF</label><button type="button" class="secondary" data-duplicate-column="${columnIndex}">Dupliquer</button><button type="button" class="danger" data-delete-column="${columnIndex}">Supprimer</button></div></article>`).join("")}</div><button type="button" class="secondary wide" data-add-column>＋ Ajouter une colonne</button></div><div class="grid2 full"><div class="field"><label>Minimum de lignes</label><input type="number" min="0" max="100" data-template-property="minRows" data-value-kind="number" value="${section.minRows || 0}"></div><div class="field"><label>Maximum de lignes</label><input type="number" min="1" max="100" data-template-property="maxRows" data-value-kind="number" value="${section.maxRows || 30}"></div></div><label class="setting-check"><input type="checkbox" data-template-property="allowAddRows" ${section.allowAddRows !== false ? "checked" : ""}> Autoriser le technicien à ajouter des lignes</label><div class="field full"><label>Mode d’affichage</label><select data-template-property="tableMode"><option value="table" ${section.tableMode === "table" ? "selected" : ""}>Colonnes classiques</option><option value="rows" ${section.tableMode === "rows" ? "selected" : ""}>Ligne par ligne</option><option value="cards" ${section.tableMode === "cards" ? "selected" : ""}>Cartes</option><option value="compact" ${section.tableMode === "compact" ? "selected" : ""}>Compact</option><option value="detailed" ${section.tableMode === "detailed" ? "selected" : ""}>Détaillé</option></select></div>`);
        fields.push(`<div class="field full"><label>Lignes présentes par défaut</label><div class="advanced-column-list">${(section.defaultRows || []).map((row, rowIndex) => `<article class="advanced-column" data-default-row-index="${rowIndex}"><div class="advanced-column-head"><strong>Ligne ${rowIndex + 1}</strong><div class="actions"><button type="button" class="secondary" data-duplicate-default-row="${rowIndex}">Dupliquer</button><button type="button" class="danger" data-delete-default-row="${rowIndex}">Supprimer</button></div></div><div class="grid2">${(section.columns || []).filter((column) => !["row_number", "calculated", "photo"].includes(column.type)).map((column) => `<div class="field"><label>${escapeHtml(column.label)}</label><input data-default-row-column="${escapeHtml(column.key)}" value="${escapeHtml(row[column.key] ?? column.defaultValue ?? "")}"></div>`).join("")}</div></article>`).join("") || '<p class="muted">Aucune ligne prédéfinie.</p>'}</div><button type="button" class="secondary wide" data-add-default-row>＋ Ajouter une ligne prédéfinie</button></div>`);
    }
    if (["photo", "multi_photo", "event_photos"].includes(section.type)) {
        fields.push(`<div class="field"><label>Nombre maximum de photos</label><input type="number" min="1" max="20" ${property("maxPhotos", section.maxPhotos || (section.type === "photo" ? 1 : 5), "number")}></div>`);
    }
    return fields.join("");
}

function renderTemplateDraft() {
    const container = document.getElementById("template-fields");
    if (!container) return;
    container.innerHTML = templateDraftSections.length ? templateDraftSections.map((section, index) => templateSectionCard(section, index)).join("") : `<div class="empty">Ajoutez les blocs qui composeront ce rapport.</div>`;
    container.querySelectorAll("[data-configure-template-field]").forEach((button) => button.addEventListener("click", () => openTemplateSectionDrawer(Number(button.dataset.configureTemplateField))));
    container.querySelectorAll("[data-move-template-up]").forEach((button) => button.addEventListener("click", () => moveTemplateField(Number(button.dataset.moveTemplateUp), -1)));
    container.querySelectorAll("[data-move-template-down]").forEach((button) => button.addEventListener("click", () => moveTemplateField(Number(button.dataset.moveTemplateDown), 1)));
    container.querySelectorAll("[data-remove-template-field]").forEach((button) => button.addEventListener("click", () => { templateDraftSections.splice(Number(button.dataset.removeTemplateField), 1); renderTemplateDraft(); }));
    let draggedIndex = null;
    container.querySelectorAll("[data-template-drag-index]").forEach((row) => {
        row.addEventListener("dragstart", (event) => { draggedIndex = Number(row.dataset.templateDragIndex); row.classList.add("is-dragging"); event.dataTransfer.effectAllowed = "move"; });
        row.addEventListener("dragend", () => row.classList.remove("is-dragging"));
        row.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
        row.addEventListener("drop", (event) => { event.preventDefault(); const target = Number(row.dataset.templateDragIndex); if (draggedIndex === null || target === draggedIndex) return; const [moved] = templateDraftSections.splice(draggedIndex, 1); templateDraftSections.splice(target, 0, moved); renderTemplateDraft(); });
    });
    renderTemplatePreview();
}

function templateTypeLabel(type) { return TEMPLATE_FIELD_TYPES.find(([value]) => value === type)?.[1] || type; }
function templateSectionSummary(section) {
    if (["select", "checkbox"].includes(section.type)) return `${(section.options || []).length} choix : ${(section.options || []).slice(0, 3).join(", ")}${section.options?.length > 3 ? "…" : ""}`;
    if (["table", "price_table"].includes(section.type)) return `${(section.columns || []).length} colonnes : ${(section.columns || []).map((column) => typeof column === "string" ? column : column.label).join(", ")}`;
    if (["photo", "multi_photo", "event_photos"].includes(section.type)) return `${section.maxPhotos || 1} photo(s) maximum`;
    if (section.type === "number") return [section.min != null && `min. ${section.min}`, section.max != null && `max. ${section.max}`, section.unit].filter(Boolean).join(" · ") || "Nombre libre";
    return section.helpText || section.placeholder || section.defaultValue || "Aucun réglage complémentaire";
}
function templateSectionCard(section, index) {
    return `<article class="template-field-row compact ${section.width === "half" ? "half" : "full"}" draggable="true" data-template-drag-index="${index}">
      <span class="drag-handle" title="Glisser pour réordonner" aria-label="Réordonner le bloc">${icon("more")}</span>
      <div class="template-card-copy"><strong>${escapeHtml(section.label)}</strong><div class="template-card-summary"><span class="badge">${escapeHtml(templateTypeLabel(section.type))}</span>${section.required ? '<span class="badge off">Obligatoire</span>' : ""}<span class="badge off">${section.width === "half" ? "Demi-largeur" : "Pleine largeur"}</span><small>${escapeHtml(templateSectionSummary(section))}</small></div></div>
      <div class="template-card-actions"><button type="button" class="secondary icon-only" data-move-template-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="Monter ce bloc" title="Monter">↑</button><button type="button" class="secondary icon-only" data-move-template-down="${index}" ${index === templateDraftSections.length - 1 ? "disabled" : ""} aria-label="Descendre ce bloc" title="Descendre">↓</button><button type="button" class="secondary icon-only" data-configure-template-field="${index}" aria-label="Configurer ${escapeHtml(section.label)}" title="Configurer">${icon("edit")}</button></div>
    </article>`;
}

function openTemplateSectionDrawer(index, activeTab = "settings", workingDraft = null) {
    closeTemplateSectionDrawer();
    const original = templateDraftSections[index];
    if (!original) return;
    const draft = workingDraft || structuredClone(original);
    const root = document.createElement("div");
    root.id = "template-section-drawer";
    root.className = "section-drawer-backdrop";
    root.innerHTML = `<aside class="section-drawer" role="dialog" aria-modal="true" aria-labelledby="section-drawer-title">
      <header class="section-drawer-head"><div><h2 id="section-drawer-title">Configurer le bloc</h2><span class="muted">Bloc ${index + 1} · ${escapeHtml(templateTypeLabel(draft.type))}</span></div><button class="close icon-only" type="button" data-close-section-drawer aria-label="Fermer">${icon("close")}</button></header>
      <div class="section-drawer-tabs" role="tablist"><button class="${activeTab === "settings" ? "primary" : "secondary"}" type="button" data-section-tab="settings" role="tab" aria-selected="${activeTab === "settings"}">Réglages</button><button class="${activeTab === "display" ? "primary" : "secondary"}" type="button" data-section-tab="display" role="tab" aria-selected="${activeTab === "display"}">Affichage</button></div>
      <div class="section-drawer-body"><form id="section-settings-form">${activeTab === "settings" ? templateSectionSettings(draft, index) : templateSectionDisplay(draft, index)}</form></div>
      <footer class="section-drawer-footer"><button class="secondary" type="button" data-close-section-drawer>Annuler</button><button class="primary" type="button" id="apply-section-settings">Valider les réglages</button><button class="danger" type="button" id="delete-section-from-drawer">${icon("trash")} Supprimer</button><button class="secondary" type="button" id="duplicate-section">Dupliquer</button></footer>
    </aside>`;
    document.body.append(root);
    root.querySelectorAll("[data-close-section-drawer]").forEach((button) => button.addEventListener("click", closeTemplateSectionDrawer));
    root.addEventListener("mousedown", (event) => { if (event.target === root) closeTemplateSectionDrawer(); });
    root.querySelectorAll("[data-section-tab]").forEach((button) => button.addEventListener("click", () => {
        readSectionDrawerValues(draft, root);
        closeTemplateSectionDrawer();
        openTemplateSectionDrawer(index, button.dataset.sectionTab, draft);
    }));
    root.querySelector("#drawer-type")?.addEventListener("change", (event) => {
        readSectionDrawerValues(draft, root);
        const defaults = newTemplateSection(event.target.value, draft.label, draft.key);
        Object.assign(draft, defaults, { label: draft.label, key: draft.key, helpText: draft.helpText || "", width: draft.width || "full", required: draft.required || false });
        closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, "settings", draft);
    });
    document.getElementById("apply-section-settings").addEventListener("click", () => {
        readSectionDrawerValues(draft, root);
        templateDraftSections[index] = draft;
        closeTemplateSectionDrawer(); renderTemplateDraft(); renderTemplatePreview();
    });
    document.getElementById("delete-section-from-drawer").addEventListener("click", () => { templateDraftSections.splice(index, 1); closeTemplateSectionDrawer(); renderTemplateDraft(); });
    document.getElementById("duplicate-section").addEventListener("click", () => { readSectionDrawerValues(draft, root); const copy = structuredClone(draft); copy.key = `champ_${Date.now()}_${templateDraftSections.length}`; copy.label = `${copy.label} (copie)`; templateDraftSections.splice(index + 1, 0, copy); closeTemplateSectionDrawer(); renderTemplateDraft(); });
    root.querySelector("[data-add-column]")?.addEventListener("click", () => { readSectionDrawerValues(draft, root); draft.columns.push(normalizeTableColumn({ label: `Colonne ${draft.columns.length + 1}` }, draft.columns.length, draft.type === "price_table")); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); });
    root.querySelectorAll("[data-delete-column]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); if (draft.columns.length <= 1) return toast("Un tableau doit conserver au moins une colonne.", true); draft.columns.splice(Number(button.dataset.deleteColumn), 1); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelectorAll("[data-duplicate-column]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); const sourceIndex = Number(button.dataset.duplicateColumn); const copy = structuredClone(draft.columns[sourceIndex]); copy.key = `${copy.key}_copie_${Date.now()}`; copy.label = `${copy.label} (copie)`; draft.columns.splice(sourceIndex + 1, 0, copy); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelector("[data-add-default-row]")?.addEventListener("click", () => { readSectionDrawerValues(draft, root); draft.defaultRows.push(Object.fromEntries(draft.columns.filter((column) => !["row_number", "calculated", "photo"].includes(column.type)).map((column) => [column.key, column.defaultValue ?? ""]))); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); });
    root.querySelectorAll("[data-delete-default-row]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); draft.defaultRows.splice(Number(button.dataset.deleteDefaultRow), 1); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelectorAll("[data-duplicate-default-row]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); const rowIndex = Number(button.dataset.duplicateDefaultRow); draft.defaultRows.splice(rowIndex + 1, 0, structuredClone(draft.defaultRows[rowIndex])); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelector("input,select,textarea")?.focus();
}

function templateSectionSettings(section, index) {
    return `<div class="section-setting-group"><h3>Identification du champ</h3><div class="field"><label for="drawer-label">Titre affiché</label><input id="drawer-label" data-drawer-property="label" value="${escapeHtml(section.label)}" maxlength="150" required></div><div class="field"><label for="drawer-type">Type de contenu</label><select id="drawer-type" data-drawer-property="type">${TEMPLATE_FIELD_TYPES.map(([type, label]) => `<option value="${type}" ${type === section.type ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><span class="field-help">Détermine la façon dont l’information sera saisie dans le rapport.</span></div></div>
    <div class="section-setting-group"><h3>Contenu et valeurs</h3>${templateSpecificConfiguration(section, index) || '<p class="muted">Ce type de bloc ne nécessite aucun réglage supplémentaire.</p>'}</div>`;
}

function templateSectionDisplay(section, index) {
    return `<div class="section-setting-group"><h3>Disposition dans le rapport</h3><div class="field"><label for="drawer-width">Largeur du bloc</label><select id="drawer-width" data-drawer-property="width"><option value="full" ${section.width !== "half" ? "selected" : ""}>Pleine largeur</option><option value="half" ${section.width === "half" ? "selected" : ""}>Moitié de la page</option></select></div><p class="section-type-help">La demi-largeur permet de placer deux champs côte à côte lorsque l’écran ou le PDF dispose de suffisamment d’espace.</p></div>
    <div class="section-setting-group"><h3>Comportement</h3>${templateFieldSupportsRequired(section.type) ? `<label class="setting-check"><input type="checkbox" data-drawer-property="required" ${section.required ? "checked" : ""}> Ce champ doit obligatoirement être rempli</label>` : ""}<label class="setting-check"><input type="checkbox" data-drawer-property="showLabel" ${section.showLabel !== false ? "checked" : ""}> Afficher le titre du champ</label><div class="field"><label for="drawer-help">Consigne affichée à l’utilisateur</label><textarea id="drawer-help" data-drawer-property="helpText" rows="3" placeholder="Expliquez ce qui doit être renseigné">${escapeHtml(section.helpText || "")}</textarea></div></div>`;
}

function readSectionDrawerValues(section, root) {
    root.querySelectorAll("[data-drawer-property]").forEach((input) => { section[input.dataset.drawerProperty] = input.type === "checkbox" ? input.checked : input.value; });
    root.querySelectorAll("[data-template-property]").forEach((input) => {
        const kind = input.dataset.valueKind;
        section[input.dataset.templateProperty] = input.type === "checkbox" ? input.checked : kind === "list" ? input.value.split(",").map((value) => value.trim()).filter(Boolean) : kind === "lines" ? input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : kind === "number" ? Number(input.value) : kind === "nullable-number" ? (input.value === "" ? null : Number(input.value)) : input.value;
    });
    root.querySelectorAll("[data-column-index]").forEach((card) => {
        const column = section.columns[Number(card.dataset.columnIndex)];
        card.querySelectorAll("[data-column-property]").forEach((input) => {
            const value = input.type === "checkbox" ? input.checked : input.dataset.valueKind === "lines" ? input.value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean) : input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
            column[input.dataset.columnProperty] = value;
        });
    });
    section.defaultRows = [...root.querySelectorAll("[data-default-row-index]")].map((card) => Object.fromEntries([...card.querySelectorAll("[data-default-row-column]")].map((input) => [input.dataset.defaultRowColumn, input.value])));
}
function closeTemplateSectionDrawer() { document.getElementById("template-section-drawer")?.remove(); }

function templateFieldSupportsRequired(type) {
    return ["text", "textarea", "date", "number", "checkbox", "select", "creator", "gps", "address", "table", "price_table"].includes(type);
}

function moveTemplateField(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= templateDraftSections.length) return;
    [templateDraftSections[index], templateDraftSections[target]] = [templateDraftSections[target], templateDraftSections[index]];
    renderTemplateDraft();
}

function renderTemplatePreview() {
    const preview = document.getElementById("template-preview");
    if (!preview) return;
    const nom = document.getElementById("template-name")?.value.trim() || "Aperçu du rapport";
    preview.innerHTML = templateDraftSections.length
        ? renderReportFields({ nom, sections: templateDraftSections }, {})
        : `<div class="empty">Ajoutez un bloc pour afficher l’aperçu.</div>`;
}

async function saveTemplate(event, existing) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            const payload = {
                nom: document.getElementById("template-name").value.trim(),
                description: document.getElementById("template-description").value.trim() || null,
                sections: templateDraftSections,
                pdf_config: {
                    margin: Number(document.getElementById("pdf-margin").value),
                    titleSize: Number(document.getElementById("pdf-title-size").value),
                    showHeader: document.getElementById("pdf-show-header").checked,
                    showClient: document.getElementById("pdf-show-client").checked,
                    showEquipment: document.getElementById("pdf-show-equipment").checked,
                    showPhotos: document.getElementById("pdf-show-photos").checked,
                    showSignature: document.getElementById("pdf-show-signature").checked,
                    showPageNumbers: document.getElementById("pdf-show-pages").checked,
                    footerText: document.getElementById("pdf-footer").value.trim(),
                },
                actif: true,
            };
            await api(existing ? `/modeles/${existing.id}` : "/modeles", { method: existing ? "PUT" : "POST", body: JSON.stringify(payload) });
            closeModal();
            await finishMutation("modeles", existing ? "Modèle mis à jour." : "Modèle créé.");
        } catch (error) { toast(error.message, true); }
    });
}

async function deleteTemplate(id, button) {
    const template = reportTemplates.find((item) => String(item.id) === String(id));
    if (!confirm(`Supprimer définitivement le modèle « ${template?.nom || id} » ? Les rapports existants conserveront leur contenu et leur PDF.`)) return;
    await withBusy(button, async () => {
        try {
            await api(`/modeles/${id}`, { method: "DELETE" });
            await finishMutation("modeles", "Modèle supprimé définitivement.");
        } catch (error) { toast(error.message, true); }
    });
}

function openDocumentEditor() {
    if (!clients.length) return toast("Créez d’abord un client.", true);
    modal("Nouveau devis ou facture", `<form id="document-form">
      <div class="grid2"><div class="field"><label>Type</label><select name="type"><option value="DEVIS">Devis</option><option value="FACTURE">Facture</option><option value="AVOIR">Avoir</option></select></div><div class="field"><label>Statut</label><select name="statut"><option value="BROUILLON">Brouillon</option><option value="ENVOYE">Envoyé</option><option value="ACCEPTE">Accepté</option><option value="PAYE">Payé</option></select></div></div>
      <div class="field"><label>Client</label><select name="client_id" required>${clientOptions()}</select></div>
      <div class="grid2">${field("Date d’émission", "date_emission", "date", true, localDateKey(new Date()))}${field("Date d’échéance", "date_echeance", "date")}</div>
      <div class="grid2"><div class="field"><label>Devise</label><select name="devise"><option value="EUR">Euro (EUR)</option><option value="CHF">Franc suisse (CHF)</option><option value="USD">Dollar (USD)</option></select></div>${field("Mode de paiement", "mode_paiement")}</div>
      <div class="panel-head"><h2>Lignes</h2><button id="add-document-line" class="secondary" type="button">＋ Ajouter une ligne</button></div>
      <div id="document-lines"></div>
      <div class="money-summary"><div><span class="muted">Total HT</span><strong id="document-total-ht">0,00 €</strong></div><div><span class="muted">TVA</span><strong id="document-total-tva">0,00 €</strong></div><div><span class="muted">Total TTC</span><strong id="document-total-ttc">0,00 €</strong></div></div>
      <div class="field"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      <button class="primary wide" type="submit">Enregistrer le document</button>
    </form>`);
    addDocumentLine();
    document.getElementById("add-document-line").addEventListener("click", addDocumentLine);
    document.getElementById("document-form").addEventListener("submit", saveDocument);
}

function addDocumentLine(values = {}) {
    const container = document.getElementById("document-lines");
    const row = document.createElement("div");
    row.className = "document-line";
    row.innerHTML = `<div class="field line-description"><label>Description</label><input data-line="description" required value="${escapeHtml(values.description || "")}"></div><div class="field"><label>Quantité</label><input data-line="quantite" type="number" min="0.01" step="0.01" required value="${values.quantite || 1}"></div><div class="field"><label>Prix HT</label><input data-line="prix_unitaire" type="number" min="0" step="0.01" required value="${values.prix_unitaire || 0}"></div><div class="field"><label>TVA %</label><input data-line="taux_tva" type="number" min="0" max="100" step="0.1" value="${values.taux_tva ?? 20}"></div><button class="danger" type="button" aria-label="Supprimer la ligne">×</button>`;
    row.querySelector("button").addEventListener("click", () => { if (container.children.length > 1) row.remove(); updateDocumentTotals(); });
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateDocumentTotals));
    container.append(row);
    updateDocumentTotals();
}

function documentLines() {
    return [...document.querySelectorAll(".document-line")].map((row) => ({
        description: row.querySelector('[data-line="description"]').value.trim(),
        quantite: Number(row.querySelector('[data-line="quantite"]').value),
        prix_unitaire: Number(row.querySelector('[data-line="prix_unitaire"]').value),
        taux_tva: Number(row.querySelector('[data-line="taux_tva"]').value),
    }));
}

function updateDocumentTotals() {
    if (!document.getElementById("document-total-ht")) return;
    const totals = documentLines().reduce((result, line) => {
        const ht = (line.quantite || 0) * (line.prix_unitaire || 0);
        result.ht += ht; result.tva += ht * (line.taux_tva || 0) / 100; return result;
    }, { ht: 0, tva: 0 });
    document.getElementById("document-total-ht").textContent = formatMoney(totals.ht);
    document.getElementById("document-total-tva").textContent = formatMoney(totals.tva);
    document.getElementById("document-total-ttc").textContent = formatMoney(totals.ht + totals.tva);
}

async function saveDocument(event) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const button = form.querySelector("button[type='submit']");
    const payload = Object.fromEntries(new FormData(form));
    payload.lignes = documentLines();
    await withBusy(button, async () => {
        try {
            await api("/documents", { method: "POST", body: JSON.stringify(payload) });
            closeModal();
            await finishMutation("documents", "Document créé.");
        } catch (error) { toast(error.message, true); }
    });
}

function openDocumentDetails(id) {
    const item = commercialDocuments.find((document) => String(document.id) === String(id));
    if (!item) return;
    modal(item.numero || item.type, `<p><strong>${escapeHtml(item.client_nom)}</strong><br><span class="muted">${escapeHtml(item.type)} · ${escapeHtml(item.statut)} · ${formatDate(item.date_emission)}</span></p><div class="table-wrap"><table><thead><tr><th>Description</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>${(item.lignes || []).map((line) => `<tr><td data-label="Description">${escapeHtml(line.description)}</td><td data-label="Qté">${line.quantite}</td><td data-label="Prix HT">${formatMoney(line.prix_unitaire, item.devise)}</td><td data-label="TVA">${line.taux_tva}%</td><td data-label="Total HT">${formatMoney(line.montant_ht, item.devise)}</td></tr>`).join("")}</tbody></table></div><div class="money-summary"><div>Total HT<br><strong>${formatMoney(item.total_ht, item.devise)}</strong></div><div>TVA<br><strong>${formatMoney(item.total_tva, item.devise)}</strong></div><div>Total TTC<br><strong>${formatMoney(item.total_ttc, item.devise)}</strong></div></div><button class="danger wide" id="delete-open-document">Supprimer définitivement ce document</button>`);
    document.getElementById("delete-open-document").addEventListener("click", (event) => deleteDocument(item.id, event.currentTarget));
}

async function deleteDocument(id, button) {
    const item = commercialDocuments.find((document) => String(document.id) === String(id));
    const label = item?.numero || item?.type || "ce document";
    if (!confirm(`Supprimer définitivement ${label} ? Cette action est irréversible.`)) return;
    await withBusy(button, async () => {
        try { await api(`/documents/${id}`, { method: "DELETE" }); closeModal(); await finishMutation("documents", "Document supprimé."); }
        catch (error) { toast(error.message, true); }
    });
}

function openNewClient() {
    modal("Nouveau client", `<form id="client-form">${field("Nom", "nom", "text", true)}${field("Email principal", "email", "email")}<div class="field"><label>Emails destinataires des rapports</label><textarea name="report_emails_text" rows="4" placeholder="Une adresse par ligne"></textarea></div>${field("Téléphone", "telephone")}${field("Adresse", "adresse")}<button class="primary wide">Créer le client</button></form>`);
    document.getElementById("client-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"],button:not([type])');
        const values = Object.fromEntries(new FormData(form));
        values.report_emails = parseEmailList(values.report_emails_text);
        delete values.report_emails_text;
        await withBusy(button, async () => {
            try { await api("/clients", { method: "POST", body: JSON.stringify(values) }); closeModal(); await finishMutation("clients", "Client créé."); }
            catch (error) { toast(error.message, true); }
        });
    });
}

function parseEmailList(value) { return String(value || "").split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean); }

async function openClientDetails(id, tab = "info") {
    modal("Fiche client", `<div class="empty"><span class="spinner" aria-hidden="true"></span> Chargement de la fiche…</div>`);
    try {
        const detail = await api(`/clients/${id}?limit=25&offset=0`);
        renderClientDetail(detail, tab);
    } catch (error) {
        closeModal();
        toast(error.message, true);
    }
}

function renderClientDetail(detail, activeTab = "info") {
    const client = detail.client;
    const tabs = [
        ["info", "Informations"],
        ["contacts", `Contacts (${(detail.contacts || []).length})`],
        ["equipements", `Équipements (${detail.equipements.length})`],
        ...(currentUser.role === "ADMIN" ? [["devis", `Devis (${detail.pagination.devis_total})`]] : []),
        ["interventions", `Interventions (${detail.pagination.interventions_total})`],
    ];

    let content;
    if (activeTab === "contacts") {
        content = `<div class="panel-head"><div><h2>Contacts du client</h2><p class="muted">Personnes à contacter et futurs destinataires des rapports.</p></div>${currentUser.role === "ADMIN" ? '<button class="primary" data-add-client-contact>+ Ajouter</button>' : ""}</div><div class="related-list">${(detail.contacts || []).length ? detail.contacts.map((contact) => `<article class="related-card"><span><strong>${escapeHtml(contact.nom)}</strong><small>${escapeHtml(contact.fonction || "Fonction non renseignée")}</small><small>${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : "Pas d’e-mail"}${contact.telephone ? ` · <a href="tel:${escapeHtml(contact.telephone)}">${escapeHtml(contact.telephone)}</a>` : ""}</small>${contact.destinataire_rapport ? '<span class="badge">Destinataire des rapports</span>' : ""}</span>${currentUser.role === "ADMIN" ? `<span class="actions"><button class="secondary" data-edit-client-contact="${contact.id}">Modifier</button><button class="danger" data-delete-client-contact="${contact.id}">Supprimer</button></span>` : ""}</article>`).join("") : '<div class="empty">Aucun contact associé à ce client.</div>'}</div>`;
    } else if (activeTab === "equipements") {
        content = `<div class="panel-head"><h2>Équipements associés</h2>${currentUser.role === "ADMIN" ? `<button class="primary" data-add-client-equipment="${client.id}">+ Ajouter</button>` : ""}</div><div class="related-list">${detail.equipements.length ? detail.equipements.map((equipment) => `<button class="related-card" data-client-equipment="${equipment.id}"><span><strong>${escapeHtml([equipment.type, equipment.marque, equipment.modele].filter(Boolean).join(" · ") || `Équipement ${equipment.id}`)}</strong><small>N° série : ${escapeHtml(equipment.numero_serie || "—")} · Année : ${escapeHtml(equipment.annee_installation || "—")}</small><small>Dernière intervention : ${equipment.derniere_intervention_date ? `${formatDate(equipment.derniere_intervention_date)} — ${escapeHtml(equipment.derniere_intervention_titre || "")}` : "Aucune"}</small></span><span aria-hidden="true">›</span></button>`).join("") : `<div class="empty">Aucun équipement associé à ce client.</div>`}</div>`;
    } else if (activeTab === "devis" && currentUser.role === "ADMIN") {
        content = `<div class="related-list">${detail.devis.length ? detail.devis.map((document) => `<button class="related-card" data-client-document="${document.id}"><span><strong>${escapeHtml(document.numero || `Devis ${document.id}`)}</strong><small>${formatDate(document.date_emission)} · Échéance ${formatDate(document.date_echeance)} · ${escapeHtml(document.statut)}</small></span><strong>${formatMoney(document.total_ttc, document.devise)}</strong></button>`).join("") : `<div class="empty">Aucun devis pour ce client.</div>`}</div>${detail.pagination.devis_total > detail.devis.length ? `<p class="muted">Les ${detail.devis.length} devis les plus récents sont affichés sur ${detail.pagination.devis_total}.</p>` : ""}`;
    } else if (activeTab === "interventions") {
        content = `<div class="related-list">${detail.interventions.length ? detail.interventions.map((item) => `<button class="related-card" data-client-intervention="${item.id}"><span><strong>${escapeHtml(item.titre || `Intervention ${item.id}`)}</strong><small>${formatDate(item.date_intervention)} ${escapeHtml(item.heure?.slice(0, 5) || "")} · ${statusLabel(item.statut)}</small><small>${escapeHtml(item.technicien_nom || "Non assigné")} · ${escapeHtml([item.equipement_type, item.equipement_modele].filter(Boolean).join(" · ") || "Sans équipement")}</small></span><span aria-hidden="true">›</span></button>`).join("") : `<div class="empty">Aucune intervention pour ce client.</div>`}</div>${detail.pagination.interventions_total > detail.interventions.length ? `<p class="muted">Les ${detail.interventions.length} interventions les plus récentes sont affichées sur ${detail.pagination.interventions_total}.</p>` : ""}`;
    } else {
        content = `<div class="panel-head"><h2>Informations générales</h2>${currentUser.role === "ADMIN" ? `<button class="primary" data-edit-client="${client.id}">Modifier</button>` : ""}</div><div class="client-detail-grid"><div class="detail-box"><strong>Nom ou raison sociale</strong>${escapeHtml(client.nom)}</div><div class="detail-box"><strong>Contact lié</strong>${escapeHtml(client.utilisateur_nom || "Aucun compte client")}</div><div class="detail-box"><strong>E-mail principal</strong>${client.email ? `<a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a>` : "—"}</div><div class="detail-box"><strong>Destinataires des rapports</strong>${(client.report_emails || []).length ? client.report_emails.map((email) => `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`).join("<br>") : "—"}</div><div class="detail-box"><strong>Téléphone</strong>${client.telephone ? `<a href="tel:${escapeHtml(client.telephone)}">${escapeHtml(client.telephone)}</a>` : "—"}</div><div class="detail-box"><strong>Adresse</strong>${escapeHtml(client.adresse || "—")}</div><div class="detail-box"><strong>Créé le</strong>${formatDate(client.created_at)}</div><div class="detail-box"><strong>Dernière modification</strong>${formatDate(client.updated_at)}</div></div>`;
    }

    modal(client.nom, `<div class="client-tabs" role="tablist">${tabs.map(([value, label]) => `<button class="${value === activeTab ? "primary" : "secondary"}" data-client-tab="${value}" role="tab" aria-selected="${value === activeTab}">${label}</button>`).join("")}</div><section>${content}</section>`);
    document.querySelectorAll("[data-client-tab]").forEach((button) => button.addEventListener("click", () => renderClientDetail(detail, button.dataset.clientTab)));
    document.querySelector("[data-edit-client]")?.addEventListener("click", () => openEditClient(detail));
    document.querySelector("[data-add-client-contact]")?.addEventListener("click", () => openClientContactForm(detail));
    document.querySelectorAll("[data-edit-client-contact]").forEach((button) => button.addEventListener("click", () => openClientContactForm(detail, (detail.contacts || []).find((contact) => String(contact.id) === String(button.dataset.editClientContact)))));
    document.querySelectorAll("[data-delete-client-contact]").forEach((button) => button.addEventListener("click", () => deleteClientContact(detail, button.dataset.deleteClientContact, button)));
    document.querySelector("[data-add-client-equipment]")?.addEventListener("click", () => openClientEquipmentForm(detail));
    document.querySelectorAll("[data-client-equipment]").forEach((button) => button.addEventListener("click", () => openClientEquipmentDetail(detail, button.dataset.clientEquipment)));
    document.querySelectorAll("[data-client-document]").forEach((button) => button.addEventListener("click", () => {
        const document = commercialDocuments.find((item) => String(item.id) === String(button.dataset.clientDocument));
        if (!document) return toast("Le détail de ce devis n'est pas disponible.", true);
        openDocumentDetails(document.id);
    }));
    document.querySelectorAll("[data-client-intervention]").forEach((button) => button.addEventListener("click", () => openIntervention(button.dataset.clientIntervention)));
}

function clientContactFields(contact = {}) {
    return `${field("Nom complet", "nom", "text", true, contact.nom || "")}${field("Fonction", "fonction", "text", false, contact.fonction || "")}${field("E-mail", "email", "email", false, contact.email || "")}${field("Téléphone", "telephone", "tel", false, contact.telephone || "")}<label class="setting-check"><input name="destinataire_rapport" type="checkbox" ${contact.destinataire_rapport ? "checked" : ""}> Proposer ce contact comme destinataire des rapports</label>`;
}

function openClientContactForm(detail, contact = null) {
    modal(contact ? "Modifier le contact" : "Nouveau contact", `<form id="client-contact-form">${clientContactFields(contact || {})}<button class="primary wide" type="submit">Enregistrer le contact</button></form>`);
    document.getElementById("client-contact-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        const values = Object.fromEntries(new FormData(form));
        values.destinataire_rapport = form.elements.destinataire_rapport.checked;
        await withBusy(button, async () => {
            try {
                const path = contact ? `/clients/${detail.client.id}/contacts/${contact.id}` : `/clients/${detail.client.id}/contacts`;
                const saved = await api(path, { method: contact ? "PUT" : "POST", body: JSON.stringify(values) });
                detail.contacts = contact ? detail.contacts.map((item) => String(item.id) === String(saved.id) ? saved : item) : [...(detail.contacts || []), saved];
                renderClientDetail(detail, "contacts");
                toast(contact ? "Contact modifié." : "Contact ajouté.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

async function deleteClientContact(detail, contactId, button) {
    const contact = (detail.contacts || []).find((item) => String(item.id) === String(contactId));
    if (!confirm(`Supprimer le contact « ${contact?.nom || "sélectionné"} » ?`)) return;
    await withBusy(button, async () => {
        try {
            await api(`/clients/${detail.client.id}/contacts/${contactId}`, { method: "DELETE" });
            detail.contacts = detail.contacts.filter((item) => String(item.id) !== String(contactId));
            renderClientDetail(detail, "contacts");
            toast("Contact supprimé.");
        } catch (error) { toast(error.message, true); }
    });
}

function openEditClient(detail) {
    const client = detail.client;
    modal(`Modifier ${client.nom}`, `<form id="edit-client-form">${field("Nom ou raison sociale", "nom", "text", true, client.nom)}${field("E-mail principal", "email", "email", false, client.email || "")}<div class="field"><label>Emails destinataires des rapports</label><textarea name="report_emails_text" rows="4">${escapeHtml((client.report_emails || []).join("\n"))}</textarea><span class="field-help">Une adresse par ligne, 20 maximum.</span></div>${field("Téléphone", "telephone", "tel", false, client.telephone || "")}<div class="field"><label for="edit-client-address">Adresse</label><textarea id="edit-client-address" name="adresse" rows="3">${escapeHtml(client.adresse || "")}</textarea></div><button class="primary wide" type="submit">Enregistrer les modifications</button></form>`);
    document.getElementById("edit-client-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                const values = Object.fromEntries(new FormData(form));
                values.report_emails = parseEmailList(values.report_emails_text);
                delete values.report_emails_text;
                const updated = await api(`/clients/${client.id}`, { method: "PUT", body: JSON.stringify(values) });
                detail.client = { ...detail.client, ...updated };
                clients = clients.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
                renderClientDetail(detail, "info");
                toast("Fiche client mise à jour.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function equipmentFields(equipment = {}) {
    return `${field("Type", "type", "text", false, equipment.type || "")}${field("Marque", "marque", "text", false, equipment.marque || "")}${field("Modèle", "modele", "text", false, equipment.modele || "")}${field("Numéro de série", "numero_serie", "text", false, equipment.numero_serie || "")}<div class="field"><label>Année d’installation</label><input name="annee_installation" type="number" min="1900" max="2200" inputmode="numeric" value="${escapeHtml(equipment.annee_installation || "")}"></div>`;
}

function openClientEquipmentForm(detail) {
    modal(`Nouvel équipement — ${detail.client.nom}`, `<form id="client-equipment-form">${equipmentFields()}<button class="primary wide" type="submit">Créer l’équipement</button></form>`);
    document.getElementById("client-equipment-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                const values = Object.fromEntries(new FormData(form));
                values.client_id = detail.client.id;
                const equipment = await api("/equipements", { method: "POST", body: JSON.stringify(values) });
                equipements.push({ ...equipment, client_nom: detail.client.nom });
                creationEquipements.push(equipment);
                await openClientDetails(detail.client.id, "equipements");
                toast("Équipement associé au client.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function openClientEquipmentDetail(detail, equipmentId) {
    const equipment = detail.equipements.find((item) => String(item.id) === String(equipmentId));
    if (!equipment) return;
    modal("Détail de l’équipement", `<div class="client-detail-grid"><div class="detail-box"><strong>Type</strong>${escapeHtml(equipment.type || "—")}</div><div class="detail-box"><strong>Marque</strong>${escapeHtml(equipment.marque || "—")}</div><div class="detail-box"><strong>Modèle</strong>${escapeHtml(equipment.modele || "—")}</div><div class="detail-box"><strong>Numéro de série</strong>${escapeHtml(equipment.numero_serie || "—")}</div><div class="detail-box"><strong>Année d’installation</strong>${escapeHtml(equipment.annee_installation || "—")}</div><div class="detail-box"><strong>Dernière intervention</strong>${equipment.derniere_intervention_date ? `${formatDate(equipment.derniere_intervention_date)} — ${escapeHtml(equipment.derniere_intervention_titre || "")}` : "Aucune"}</div></div>${currentUser.role === "ADMIN" ? '<button class="primary wide" id="edit-client-equipment">Modifier l’équipement</button>' : ""}<button class="secondary wide" id="back-to-client">Retour à la fiche client</button>`);
    document.getElementById("edit-client-equipment")?.addEventListener("click", () => openEditEquipment(detail, equipment));
    document.getElementById("back-to-client").addEventListener("click", () => renderClientDetail(detail, "equipements"));
}

function openEditEquipment(detail, equipment) {
    modal("Modifier l’équipement", `<form id="edit-equipment-form">${equipmentFields(equipment)}<button class="primary wide" type="submit">Enregistrer</button></form>`);
    document.getElementById("edit-equipment-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                const values = Object.fromEntries(new FormData(form));
                const updated = await api(`/equipements/${equipment.id}`, { method: "PUT", body: JSON.stringify(values) });
                Object.assign(equipment, updated);
                equipements = equipements.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
                creationEquipements = creationEquipements.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
                openClientEquipmentDetail(detail, equipment.id);
                toast("Équipement modifié.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function openNewEquipment() {
    modal("Nouvel équipement", `<form id="equipment-form"><div class="field"><label>Client</label><select name="client_id" required>${clientOptions()}</select></div>${equipmentFields()}<button class="primary wide">Créer l’équipement</button></form>`);
    document.getElementById("equipment-form").addEventListener("submit", async (event) => submitForm(event, "/equipements", "equipements"));
}

function openNewTechnician() {
    modal("Ajouter un technicien", `<form id="technician-form">${field("Nom complet", "nom", "text", true)}${field("Adresse email", "email", "email", true)}<div class="field"><label for="technician-password">Mot de passe initial</label><input id="technician-password" name="password" type="password" minlength="8" autocomplete="new-password" required><span class="muted">8 caractères minimum. Le technicien pourra l’utiliser dès l’activation du compte.</span></div><button class="primary wide" type="submit">Créer le compte technicien</button></form>`);
    document.getElementById("technician-form").addEventListener("submit", (event) =>
        submitForm(event, "/auth/users", "equipe")
    );
}

function bindTeamActions() {
    document.querySelectorAll("[data-disable-technician]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            if (!confirm("Désactiver ce technicien ? Il ne pourra plus se connecter.")) return;
            try {
                const result = await api(`/auth/users/${button.dataset.disableTechnician}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ actif: false }),
                });
                replaceTechnician(result.user);
                renderMain("equipe");
                toast("Technicien désactivé.");
            } catch (error) { toast(error.message, true); }
        }))
    );
    document.querySelectorAll("[data-enable-technician]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            try {
                const result = await api(`/auth/users/${button.dataset.enableTechnician}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ actif: true }),
                });
                replaceTechnician(result.user);
                renderMain("equipe");
                toast("Technicien réactivé.");
            } catch (error) { toast(error.message, true); }
        }))
    );
    document.querySelectorAll("[data-delete-technician]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            const name = button.dataset.technicianName || "ce technicien";
            if (!confirm(`Supprimer définitivement ${name} ?\n\nLe compte sera effacé de la base de données et ses interventions seront désassignées. Cette action est irréversible.`)) return;
            try {
                const result = await api(`/auth/users/${button.dataset.deleteTechnician}`, {
                    method: "DELETE",
                });
                if (result?.deleted !== true || !result?.user?.id) {
                    throw new Error("Le serveur n'a pas confirmé la suppression définitive. Redémarrez le backend puis réessayez.");
                }
                technicians = technicians.filter(
                    (user) => String(user.id) !== String(result.user.id)
                );
                await loadAllData();
                renderMain("equipe");
                toast(`Technicien supprimé définitivement. ${result.detached_interventions} intervention(s) désassignée(s).`);
            } catch (error) { toast(error.message, true); }
        }))
    );
}

function replaceTechnician(updatedUser) {
    technicians = technicians
        .map((user) => String(user.id) === String(updatedUser.id) ? updatedUser : user)
        .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"));
}

function openNewIntervention() {
    if (!creationClients.length) return toast("Aucun client disponible. Contactez un administrateur.", true);
    const eligibleClients = creationClients.filter((client) =>
        creationEquipements.some((item) => String(item.client_id) === String(client.id))
    );
    if (!eligibleClients.length) return toast("Aucun client ne possède encore d'équipement.", true);
    const firstClientId = eligibleClients[0].id;
    const technicianField = currentUser.role === "ADMIN"
        ? `<div class="field"><label>Technicien assigné</label><select name="technicien_id">${technicianOptions()}</select></div>`
        : `<div class="field"><label>Technicien</label><input value="${escapeHtml(currentUser.nom)}" disabled></div>`;
    modal("Nouveau rapport", `<form id="intervention-form"><div class="grid2"><div class="field"><label>Client</label><select id="new-client" name="client_id" required>${creationClientOptions(eligibleClients)}</select></div>${technicianField}</div><div class="field"><label>Équipement concerné</label><select id="new-equipment" name="equipement_id" required>${creationEquipmentOptions(firstClientId)}</select></div>${field("Titre du rapport", "titre", "text", true)}<div class="field"><label>Description</label><textarea name="description"></textarea></div><div class="grid2">${field("Date", "date_intervention", "date")}${field("Heure", "heure", "time")}</div><div class="field"><label>Modèle de rapport</label><select id="new-report-template" name="modele_rapport_id"><option value="">Rapport libre</option>${reportTemplates.filter((template) => template.actif).map((template) => `<option value="${template.id}">${escapeHtml(template.nom)}</option>`).join("")}</select></div><div id="new-report-fields"></div><button class="primary wide">Créer le rapport</button></form>`);
    document.getElementById("new-client").addEventListener("change", (event) => {
        const equipmentSelect = document.getElementById("new-equipment");
        equipmentSelect.innerHTML = creationEquipmentOptions(event.target.value);
        equipmentSelect.disabled = !equipmentSelect.options.length;
    });
    document.getElementById("new-report-template").addEventListener("change", (event) => {
        const template = reportTemplates.find((item) => String(item.id) === String(event.target.value));
        document.getElementById("new-report-fields").innerHTML = template ? renderReportFields(template, {}) : "";
        bindReportFieldActions(document.getElementById("new-report-fields"));
    });
    document.getElementById("intervention-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector("button[type='submit'], button:not([type])");
        const values = Object.fromEntries(new FormData(form));
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        values.donnees_rapport = collectReportData(form);
        await withBusy(button, async () => {
            try {
                await api("/interventions", { method: "POST", body: JSON.stringify(values) });
                closeModal();
                await finishMutation("interventions", "Rapport créé.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function renderReportFields(template, data = {}) {
    const sections = Array.isArray(template?.sections || template?.modele_rapport_sections) ? (template.sections || template.modele_rapport_sections) : [];
    if (!sections.length) return "";
    return `<section class="panel"><div class="panel-head"><div><h2>${escapeHtml(template.nom || template.modele_rapport_nom || "Rapport personnalisé")}</h2><p class="muted">Complétez les contrôles définis dans le modèle.</p></div></div><div class="report-fields-grid">${sections.map((section) => {
        const value = Object.hasOwn(data || {}, section.key)
            ? data[section.key]
            : section.type === "date" && section.dateMode !== "datetime-local"
              ? localDateKey(new Date())
              : (section.defaultValue ?? "");
        const attributes = `data-report-key="${escapeHtml(section.key)}" ${section.required ? "required" : ""}`;
        const labelClass = section.showLabel === false ? ' class="sr-only"' : "";
        const label = `<label${labelClass}>${escapeHtml(section.label)}${section.required ? " *" : ""}</label>`;
        const help = section.helpText ? `<span class="field-help">${escapeHtml(section.helpText)}</span>` : "";
        const wrapper = (content, extra = "") => `<div class="report-field ${section.width === "half" ? "half" : "full"} ${extra}">${content}${help}</div>`;
        if (section.type === "title") return `<h3 class="report-section-title">${escapeHtml(section.label)}</h3>`;
        if (section.type === "page_break") return `<div class="report-page-break"><hr><span class="field-help">Saut de page dans le PDF</span></div>`;
        if (["photo", "multi_photo", "event_photos"].includes(section.type)) return wrapper(`<div class="field">${label}<p class="muted">📷 Ajoutez jusqu’à ${Number(section.maxPhotos || (section.type === "photo" ? 1 : 5))} photo(s) depuis la fiche de l’intervention.</p></div>`);
        if (["signature", "electronic_signature"].includes(section.type)) return wrapper(`<div class="field">${label}<p class="muted">✍ La signature est recueillie dans la fiche de l’intervention et intégrée au PDF.</p></div>`);
        if (section.type === "equipment") return wrapper(`<div class="field">${label}<p class="muted">◇ Les informations de l’équipement sélectionné sont insérées automatiquement.</p></div>`);
        if (section.type === "creator") return wrapper(`<div class="field">${label}<input value="${escapeHtml(currentUser.nom)}" disabled><input type="hidden" data-report-key="${escapeHtml(section.key)}" value="${escapeHtml(currentUser.nom)}"></div>`);
        if (section.type === "gps") return wrapper(`<div class="field">${label}<div class="actions"><input ${attributes} value="${escapeHtml(value || "")}" placeholder="${escapeHtml(section.placeholder || "Latitude, longitude")}"><button type="button" class="secondary" data-capture-gps>Utiliser ma position</button></div></div>`);
        if (section.type === "address") return wrapper(`<div class="field">${label}<input ${attributes} value="${escapeHtml(value || "")}" autocomplete="street-address" placeholder="${escapeHtml(section.placeholder || "Adresse complète")}"></div>`);
        if (["table", "price_table"].includes(section.type)) return renderReportTable(section, Array.isArray(value) ? value : []);
        if (section.type === "textarea") return wrapper(`<div class="field">${label}<textarea ${attributes} rows="${Number(section.rows || 4)}" placeholder="${escapeHtml(section.placeholder || "")}">${escapeHtml(value || "")}</textarea></div>`);
        if (section.type === "select") {
            const choices = [...(section.options || []), ...(section.allowOther ? ["Autre"] : [])];
            const selected = Array.isArray(value) ? value : [value];
            if (section.multiple || ["radio", "checkboxes", "segments"].includes(section.listMode)) {
                const inputType = section.multiple || section.listMode === "checkboxes" ? "checkbox" : "radio";
                return wrapper(`<fieldset class="field"><legend class="${section.showLabel === false ? "sr-only" : ""}">${escapeHtml(section.label)}${section.required ? " *" : ""}</legend><div class="checkbox-options list-mode-${escapeHtml(section.listMode || "radio")}">${choices.map((option) => `<label><input type="${inputType}" data-report-checkbox-group="${escapeHtml(section.key)}" name="${escapeHtml(section.key)}" value="${escapeHtml(option)}" ${selected.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></fieldset>`);
            }
            return wrapper(`<div class="field">${label}<select ${attributes}><option value="">${escapeHtml(section.placeholder || "Sélectionner")}</option>${choices.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`);
        }
        if (section.type === "checkbox" && (section.options || []).length) {
            const selected = Array.isArray(value) ? value : [];
            return wrapper(`<fieldset class="field"><legend class="${section.showLabel === false ? "sr-only" : ""}">${escapeHtml(section.label)}${section.required ? " *" : ""}</legend><div class="checkbox-options">${section.options.map((option) => `<label><input type="checkbox" data-report-checkbox-group="${escapeHtml(section.key)}" value="${escapeHtml(option)}" ${selected.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></fieldset>`);
        }
        if (section.type === "checkbox") return wrapper(`<div class="field"><label><input type="checkbox" ${attributes} ${value ? "checked" : ""}> ${escapeHtml(section.label)}${section.required ? " *" : ""}</label></div>`);
        const inputType = section.type === "date" ? (section.dateMode || "date") : section.type === "number" ? "number" : "text";
        const numberRules = section.type === "number" ? `${section.min !== null && section.min !== undefined ? `min="${Number(section.min)}"` : ""} ${section.max !== null && section.max !== undefined ? `max="${Number(section.max)}"` : ""} step="${Number(section.step || 1)}"` : "";
        return wrapper(`<div class="field">${label}<div class="actions"><input type="${inputType}" ${attributes} ${numberRules} value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(section.placeholder || "")}">${section.unit ? `<span class="muted">${escapeHtml(section.unit)}</span>` : ""}</div></div>`);
    }).join("")}</div></section>`;
}

function tableCellInput(column, value, rowIndex) {
    const common = `data-table-column="${escapeHtml(column.key)}" ${column.required ? "required" : ""} aria-label="${escapeHtml(column.label)}"`;
    if (column.type === "row_number") return `<input ${common} value="${rowIndex + 1}" readonly>`;
    if (column.type === "select") return `<select ${common}><option value="">Sélectionner</option>${column.options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}${column.allowOther ? '<option value="__other__">Autre…</option>' : ""}</select>`;
    if (["boolean", "checkbox"].includes(column.type)) return `<input type="checkbox" ${common} ${value === true || value === "true" ? "checked" : ""}>`;
    if (column.type === "textarea") return `<textarea ${common} rows="2">${escapeHtml(value ?? column.defaultValue ?? "")}</textarea>`;
    if (column.type === "photo") return `<input type="file" ${common} accept="image/png,image/jpeg,image/webp">`;
    const type = ({ integer: "number", decimal: "number", currency: "number", percentage: "number", date: "date", time: "time", datetime: "datetime-local", calculated: "number" })[column.type] || "text";
    const numeric = ["integer", "decimal", "currency", "percentage", "calculated"].includes(column.type);
    const step = column.type === "integer" ? 1 : 1 / (10 ** (column.decimals || 2));
    const limits = numeric ? `${column.min != null ? `min="${Number(column.min)}"` : ""} ${column.max != null ? `max="${Number(column.max)}"` : ""} step="${step}"` : "";
    return `<input type="${type}" ${common} ${limits} ${column.type === "calculated" ? "readonly" : ""} value="${escapeHtml(value ?? column.defaultValue ?? "")}">`;
}

function reportTableRow(columns, values = {}, _priceTable = false, rowIndex = 0) {
    return `<tr>${columns.filter((column) => column.visibleForm !== false).map((column) => `<td data-label="${escapeHtml(column.label)}" style="text-align:${column.align}">${tableCellInput(column, values[column.key], rowIndex)}</td>`).join("")}<td data-label="Action"><button type="button" class="danger" data-remove-report-row aria-label="Supprimer la ligne">×</button></td></tr>`;
}

function renderReportTable(section, rows) {
    const columns = (section.columns?.length ? section.columns : ["Colonne 1", "Colonne 2"]).map((column, index) => normalizeTableColumn(column, index, section.type === "price_table"));
    const initialRows = rows.length ? rows : (section.defaultRows?.length ? structuredClone(section.defaultRows) : Array.from({ length: Math.max(1, section.minRows || 0) }, () => ({})));
    return `<div class="report-table field mode-${escapeHtml(section.tableMode || "table")}" data-report-table="${escapeHtml(section.key)}" data-columns="${escapeHtml(JSON.stringify(columns))}" data-min-rows="${Number(section.minRows || 0)}" data-max-rows="${Number(section.maxRows || 30)}"><label class="${section.showLabel === false ? "sr-only" : ""}">${escapeHtml(section.label)}${section.required ? " *" : ""}</label>${section.helpText ? `<span class="field-help">${escapeHtml(section.helpText)}</span>` : ""}<table><thead><tr>${columns.filter((column) => column.visibleForm !== false).map((column) => `<th style="width:${column.width}fr;text-align:${column.align}">${escapeHtml(column.label)}${column.required ? " *" : ""}</th>`).join("")}<th></th></tr></thead><tbody>${initialRows.map((row, rowIndex) => reportTableRow(columns, row, false, rowIndex)).join("")}</tbody></table>${section.allowAddRows !== false ? '<div class="report-table-actions"><button type="button" class="secondary" data-add-report-row>＋ Ajouter une ligne</button></div>' : ""}<div class="report-table-total" data-table-calculations></div></div>`;
}

function collectReportData(form) {
    const data = [...form.querySelectorAll("[data-report-key]")].reduce((result, input) => {
        result[input.dataset.reportKey] = input.type === "checkbox" ? input.checked : input.type === "number" && input.value !== "" ? Number(input.value) : input.value;
        return result;
    }, {});
    const groupKeys = new Set([...form.querySelectorAll("[data-report-checkbox-group]")].map((input) => input.dataset.reportCheckboxGroup));
    groupKeys.forEach((key) => { data[key] = [...form.querySelectorAll(`[data-report-checkbox-group="${CSS.escape(key)}"]:checked`)].map((input) => input.value); });
    form.querySelectorAll("[data-report-table]").forEach((table) => {
        data[table.dataset.reportTable] = [...table.querySelectorAll("tbody tr")].map((row) => Object.fromEntries(
            [...row.querySelectorAll("[data-table-column]")].filter((input) => input.type !== "file").map((input) => [input.dataset.tableColumn, input.type === "checkbox" ? input.checked : input.type === "number" && input.value !== "" ? Number(input.value) : input.value.trim()])
        )).filter((row) => Object.values(row).some((value) => value !== ""));
    });
    return data;
}

function bindReportFieldActions(container = document) {
    container.querySelectorAll("[data-capture-gps]").forEach((button) => button.addEventListener("click", () => {
        if (!navigator.geolocation) return toast("La géolocalisation n’est pas disponible sur cet appareil.", true);
        withBusy(button, () => new Promise((resolve) => navigator.geolocation.getCurrentPosition(
            (position) => {
                const input = button.closest(".field").querySelector("[data-report-key]");
                input.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                toast("Position GPS ajoutée."); resolve();
            },
            () => { toast("Impossible d’obtenir la position. Vérifiez l’autorisation GPS.", true); resolve(); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )));
    }));
    container.querySelectorAll("[data-report-table]").forEach((table) => {
        const columns = JSON.parse(table.dataset.columns || "[]");
        const recalculate = () => {
            const rows = [...table.querySelectorAll("tbody tr")];
            const summaries = [];
            columns.forEach((column) => {
                if (!column.calculation) return;
                const numbers = rows.map((row) => Number(row.querySelector(`[data-table-column="${CSS.escape(column.key)}"]`)?.value || 0));
                const result = column.calculation === "sum" ? numbers.reduce((a, b) => a + b, 0) : column.calculation === "average" ? numbers.reduce((a, b) => a + b, 0) / Math.max(1, numbers.length) : column.calculation === "count" ? rows.length : 0;
                summaries.push(`${column.label} : ${column.type === "currency" ? formatMoney(result) : result.toLocaleString("fr-FR")}`);
            });
            table.querySelector("[data-table-calculations]").textContent = summaries.join(" · ");
        };
        table.addEventListener("click", (event) => {
            const remove = event.target.closest("[data-remove-report-row]");
            if (remove) {
                const rows = table.querySelectorAll("tbody tr");
                if (rows.length > Number(table.dataset.minRows || 0) && rows.length > 1) remove.closest("tr").remove();
                else remove.closest("tr").querySelectorAll("input").forEach((input) => { input.value = ""; });
                recalculate();
            }
            if (event.target.closest("[data-add-report-row]")) {
                const rows = table.querySelectorAll("tbody tr");
                if (rows.length >= Number(table.dataset.maxRows || 30)) return toast("Nombre maximum de lignes atteint.", true);
                table.querySelector("tbody").insertAdjacentHTML("beforeend", reportTableRow(columns, {}, false, rows.length));
            }
        });
        table.addEventListener("input", recalculate);
        recalculate();
    });
}

function reportDataSummary(item) {
    const sections = Array.isArray(item.modele_rapport_sections) ? item.modele_rapport_sections : [];
    const data = item.donnees_rapport || {};
    const rows = sections.filter((section) => Object.hasOwn(data, section.key) && !["title", "page_break", "photo", "multi_photo", "event_photos", "signature", "electronic_signature"].includes(section.type));
    if (!rows.length) return "";
    return `<section class="panel"><h3>${escapeHtml(item.modele_rapport_nom || "Informations du rapport")}</h3>${rows.map((section) => {
        const value = data[section.key];
        if (["table", "price_table"].includes(section.type) && Array.isArray(value)) {
            const columns = section.columns || [];
            return `<div class="table-wrap"><strong>${escapeHtml(section.label)}</strong><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${value.map((row) => `<tr>${columns.map((_, index) => `<td data-label="${escapeHtml(columns[index])}">${escapeHtml(row?.[`c${index}`] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        }
        const display = typeof value === "boolean" ? (value ? "Oui" : "Non") : Array.isArray(value) ? value.join(", ") : value || "—";
        return `<p><strong>${escapeHtml(section.label)}</strong><br>${escapeHtml(display)}</p>`;
    }).join("")}</section>`;
}

async function submitForm(event, path, view) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const submitButton = form.querySelector("button[type='submit'], button:not([type])");
    const values = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
    await withBusy(submitButton, async () => {
        try {
            await api(path, { method: "POST", body: JSON.stringify(values) });
            closeModal();
            await finishMutation(view, "Enregistrement effectué.");
        } catch (error) { toast(error.message, true); }
    });
}

function openIntervention(id) {
    const item = interventions.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    if (currentUser.role === "CLIENT") {
        modal("Rapport", `<p><strong>${escapeHtml(item.titre)}</strong><br><span class="muted">${escapeHtml(item.client_nom)} · ${formatDate(item.date_intervention)}</span></p><div class="field"><label>Description</label><p>${escapeHtml(item.description || "Aucune description.")}</p></div><div class="field"><label>Compte-rendu</label><p>${escapeHtml(item.compte_rendu || "Compte-rendu non disponible.")}</p></div>${reportDataSummary(item)}${mediaGallery(item)}${pdfButton(item)}`);
        bindPdfDownload();
        return;
    }

    const selectedTemplateId = item.modele_rapport_id || (item.modele_rapport_sections?.length ? "__snapshot__" : "");
    const templateSelector = `<div class="field"><label>Modèle de rapport</label><select id="edit-report-template" name="modele_rapport_id"><option value="">Rapport libre</option>${selectedTemplateId === "__snapshot__" ? `<option value="__snapshot__" selected>${escapeHtml(item.modele_rapport_nom || "Modèle supprimé")} (contenu conservé)</option>` : ""}${reportTemplates.filter((template) => template.actif).map((template) => `<option value="${template.id}" ${String(template.id) === String(selectedTemplateId) ? "selected" : ""}>${escapeHtml(template.nom)}</option>`).join("")}</select></div>`;
    const adminFields = currentUser.role === "ADMIN" ? `<div class="grid2"><div class="field"><label>Client</label><select id="edit-client" name="client_id">${creationClientOptions(creationClients, item.client_id)}</select></div><div class="field"><label>Technicien assigné</label><select name="technicien_id">${technicianOptions(item.technicien_id)}</select></div></div><div class="field"><label>Équipement concerné</label><select id="edit-equipment" name="equipement_id">${creationEquipmentOptions(item.client_id, item.equipement_id, true)}</select></div>${field("Titre", "titre", "text", true, item.titre)}<div class="field"><label>Description</label><textarea name="description" rows="3">${escapeHtml(item.description || "")}</textarea></div><div class="grid2">${field("Date", "date_intervention", "date", false, String(item.date_intervention || "").slice(0,10))}${field("Heure", "heure", "time", false, String(item.heure || "").slice(0,5))}</div>${templateSelector}` : "";
    const localDraft = loadReportDraft(item);
    const customReportFields = Array.isArray(item.modele_rapport_sections) && item.modele_rapport_sections.length
        ? renderReportFields(item, localDraft?.payload?.donnees_rapport || item.donnees_rapport || {})
        : "";
    modal("Rapport d’intervention", `<form id="edit-intervention-form" data-intervention-id="${item.id}">
      <p><strong>${escapeHtml(item.titre)}</strong><br><span class="muted">${escapeHtml(item.client_nom)} · ${formatDate(item.date_intervention)}</span></p>
      ${adminFields}
      <input type="hidden" name="statut" value="${escapeHtml(item.statut || "TERMINEE")}">
      <div class="field"><label>Compte-rendu</label><textarea name="compte_rendu" rows="5">${escapeHtml(item.compte_rendu || "")}</textarea></div>
      <div id="edit-report-fields">${customReportFields}</div>
      <div id="report-autosave-status" class="autosave-status saved" role="status" aria-live="polite">${icon("check")} Enregistré</div>
      <button class="primary wide">Enregistrer le rapport</button>
    </form><hr>${fileUpload({ id: "photo-file", name: "photo", label: "Ajouter une photo", help: "PNG, JPEG, WebP ou photo de l’appareil", accept: "image/png,image/jpeg,image/webp", maxMb: 5, capture: "environment" })}<button class="secondary wide" id="upload-photo" type="button">${icon("upload")} Envoyer la photo</button>
    <div class="field"><label>Signature client</label><canvas id="signature-canvas" class="canvas"></canvas><div class="actions"><button class="secondary" id="clear-signature">Effacer</button><button class="primary" id="upload-signature">Enregistrer la signature</button></div></div>
    ${mediaGallery(item, true)}${pdfButton(item, true)}${emailButton(item)}`);

    bindReportFieldActions(document.getElementById("edit-intervention-form"));
    restoreReportDraft(item, document.getElementById("edit-intervention-form"));
    bindReportAutosave(item, document.getElementById("edit-intervention-form"));

    document.getElementById("edit-intervention-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const submitButton = form.querySelector("button[type='submit'], button:not([type])");
        const values = Object.fromEntries(new FormData(form));
        values.expected_version = item.report_version || 1;
        if (values.modele_rapport_id === "__snapshot__") delete values.modele_rapport_id;
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        if (form.querySelector("[data-report-key]")) values.donnees_rapport = collectReportData(form);
        await withBusy(submitButton, async () => {
            try {
                const updated = await api(`/interventions/${id}`, { method: "PUT", body: JSON.stringify(values) });
                item.report_version = updated.report_version;
                clearReportDraft(item.id);
                reportAutosavePending = false;
                closeModal();
                await finishMutation("interventions", "Rapport enregistré.");
            } catch (error) { toast(error.message, true); }
        });
    });
    document.getElementById("edit-client")?.addEventListener("change", (event) => {
        document.getElementById("edit-equipment").innerHTML = creationEquipmentOptions(event.target.value, null, true);
    });
    document.getElementById("edit-report-template")?.addEventListener("change", (event) => {
        const container = document.getElementById("edit-report-fields");
        if (event.target.value === "__snapshot__") container.innerHTML = renderReportFields(item, item.donnees_rapport || {});
        else {
            const template = reportTemplates.find((entry) => String(entry.id) === String(event.target.value));
            container.innerHTML = template ? renderReportFields(template, {}) : "";
        }
        bindReportFieldActions(container);
    });
    bindFileUpload(document.querySelector("#photo-file")?.closest("[data-file-upload]"));
    document.getElementById("upload-photo").addEventListener("click", () => uploadPhoto(id));
    setupSignatureCanvas(id);
    bindMediaActions(item);
    bindPdfDownload();
    bindReportEmail(item);
}

function reportDraftKey(id) { return `intervium_report_draft:${currentEntreprise?.id || currentUser?.entreprise_id}:${currentUser?.id}:${id}`; }
function loadReportDraft(item) { try { const draft = JSON.parse(localStorage.getItem(reportDraftKey(item.id)) || "null"); return draft?.payload && Number(draft.version) === Number(item.report_version || 1) ? draft : null; } catch { return null; } }
function clearReportDraft(id) { try { localStorage.removeItem(reportDraftKey(id)); } catch {} }
function setAutosaveStatus(state, label) {
    const node = document.getElementById("report-autosave-status"); if (!node) return;
    node.className = `autosave-status ${state}`;
    node.innerHTML = `${state === "saving" ? '<span class="spinner"></span>' : icon(state === "saved" ? "check" : "alert")} ${escapeHtml(label)}`;
}
function currentReportPayload(form) {
    const data = Object.fromEntries(new FormData(form));
    return { statut: data.statut, compte_rendu: data.compte_rendu || null, donnees_rapport: collectReportData(form) };
}
function persistReportDraft(item, payload) {
    try { localStorage.setItem(reportDraftKey(item.id), JSON.stringify({ interventionId: item.id, version: item.report_version || 1, payload, savedAt: new Date().toISOString() })); } catch {}
}
function restoreReportDraft(item, form) {
    const draft = loadReportDraft(item);
    if (!draft) return;
    if (draft.payload.statut && form.elements.statut) form.elements.statut.value = draft.payload.statut;
    if (form.elements.compte_rendu && draft.payload.compte_rendu !== null) form.elements.compte_rendu.value = draft.payload.compte_rendu;
    Object.entries(draft.payload.donnees_rapport || {}).forEach(([key, value]) => {
        const input = form.querySelector(`[data-report-key="${CSS.escape(key)}"]`);
        if (input && !Array.isArray(value)) input.value = value ?? "";
    });
    reportAutosavePending = true;
    setAutosaveStatus("dirty", "Brouillon local restauré");
}
function bindReportAutosave(item, form) {
    const schedule = (event) => {
        const target = event.target;
        const reportInput = target.matches('[name="statut"],[name="compte_rendu"],[data-report-key],[data-report-checkbox-group],[data-table-column]');
        if (!reportInput) return;
        reportAutosavePending = true;
        const payload = currentReportPayload(form);
        persistReportDraft(item, payload);
        setAutosaveStatus("dirty", "Modifications non enregistrées");
        clearTimeout(reportAutosaveTimer);
        reportAutosaveTimer = setTimeout(() => saveReportDraft(item, form), 1200);
    };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
}
async function saveReportDraft(item, form) {
    if (!document.body.contains(form) || !reportAutosavePending) return;
    const payload = { ...currentReportPayload(form), expected_version: item.report_version || 1 };
    setAutosaveStatus("saving", "Enregistrement…");
    try {
        const updated = await api(`/interventions/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
        item.report_version = updated.report_version;
        item.statut = updated.statut;
        item.compte_rendu = updated.compte_rendu;
        item.donnees_rapport = updated.donnees_rapport;
        reportAutosavePending = false;
        clearReportDraft(item.id);
        setAutosaveStatus("saved", "Enregistré");
    } catch (error) {
        persistReportDraft(item, payload);
        setAutosaveStatus("error", error.code === "REPORT_VERSION_CONFLICT" ? "Conflit : rechargez le rapport" : "Erreur de sauvegarde — brouillon conservé");
    }
}

window.addEventListener("beforeunload", (event) => { if (reportAutosavePending) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("online", () => { const form = document.getElementById("edit-intervention-form"); const item = interventions.find((entry) => String(entry.id) === String(form?.dataset.interventionId)); if (form && item && loadReportDraft(item)) saveReportDraft(item, form); });

async function uploadPhoto(id) {
    const item = interventions.find((entry) => String(entry.id) === String(id));
    const photoSections = (item?.modele_rapport_sections || []).filter((section) => ["photo", "multi_photo", "event_photos"].includes(section.type));
    const photoLimit = photoSections.reduce((total, section) => total + Math.max(1, Number(section.maxPhotos) || (section.type === "photo" ? 1 : 5)), 0);
    if (photoSections.length && (item.photos || []).length >= photoLimit) {
        return toast(`La limite de ${photoLimit} photo(s) définie par le modèle est atteinte.`, true);
    }
    const input = document.getElementById("photo-file");
    const file = input?.files?.[0];
    if (!file) return toast("Sélectionnez une photo.", true);
    if (!input.checkValidity()) return toast(input.validationMessage, true);
    const formData = new FormData();
    formData.append("photo", file);
    const button = document.getElementById("upload-photo");
    await withBusy(button, async () => {
        try {
            const result = await api(`/uploads/photo/${id}`, { method: "POST", body: formData });
            item.photos = [...(Array.isArray(item.photos) ? item.photos : []), result.photo];
            item.nombre_photos = item.photos.length;
            openIntervention(id);
            toast("Photo envoyée.");
        } catch (error) { toast(error.message, true); }
    });
}

function setupSignatureCanvas(id) {
    const canvas = document.getElementById("signature-canvas");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio); context.lineWidth = 2; context.lineCap = "round"; context.strokeStyle = "#172554";
    let drawing = false;
    let hasInk = false;
    const point = (event) => { const box = canvas.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };
    canvas.addEventListener("pointerdown", (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
    canvas.addEventListener("pointermove", (event) => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); hasInk = true; });
    canvas.addEventListener("pointerup", () => { drawing = false; });
    document.getElementById("clear-signature").addEventListener("click", () => { context.clearRect(0, 0, canvas.width, canvas.height); hasInk = false; });
    document.getElementById("upload-signature").addEventListener("click", async () => {
        if (!hasInk) return toast("La signature est vide.", true);
        const button = document.getElementById("upload-signature");
        await withBusy(button, async () => {
            try {
                const result = await api(`/uploads/signature/${id}`, { method: "POST", body: JSON.stringify({ signatureData: canvas.toDataURL("image/png") }) });
                const item = interventions.find((entry) => String(entry.id) === String(id));
                item.signature_url = result.signature_url;
                openIntervention(id);
                toast("Signature enregistrée.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

async function refresh(view) { await loadAllData(); renderMain(view); }
async function finishMutation(view, successMessage) {
    try {
        await refresh(view);
        toast(successMessage);
    } catch (error) {
        renderMain(view);
        toast(`${successMessage} Actualisation partielle : ${error.message}`, true);
    }
}
async function reloadModal(id, successMessage) {
    try {
        await loadAllData();
        openIntervention(id);
        toast(successMessage);
    } catch (error) {
        toast(`${successMessage} Rouvrez la fiche pour actualiser l'aperçu.`, true);
    }
}
async function withBusy(button, action) {
    if (!button || button.disabled) return;
    const previousContent = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="sr-only">Traitement en cours</span>`;
    try { await action(); } finally {
        if (button.isConnected) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = previousContent;
        }
    }
}
function clientOptions(selectedId = null) { return clients.map((c) => `<option value="${c.id}" ${String(c.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(c.nom)}</option>`).join(""); }
function creationClientOptions(source = creationClients, selectedId = null) { return source.map((client) => `<option value="${client.id}" ${String(client.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(client.nom)}</option>`).join(""); }
function creationEquipmentOptions(clientId, selectedId = null, allowEmpty = false) {
    const options = creationEquipements.filter((item) => String(item.client_id) === String(clientId));
    return `${allowEmpty ? '<option value="">Non renseigné</option>' : ""}${options.map((item) => `<option value="${item.id}" ${String(item.id) === String(selectedId) ? "selected" : ""}>${escapeHtml([item.type, item.modele, item.numero_serie].filter(Boolean).join(" · ") || `Équipement ${item.id}`)}</option>`).join("")}`;
}
function technicianOptions(selectedId = null) { return `<option value="">Non assigné</option>${technicians.filter((user) => user.actif || String(user.id) === String(selectedId)).map((user) => `<option value="${user.id}" ${String(user.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(user.nom)}${user.actif ? "" : " (désactivé)"}</option>`).join("")}`; }
function mediaGallery(item, allowPdfSelection = false) {
    const photos = Array.isArray(item.photos) ? item.photos : [];
    if (!photos.length && !item.signature_url) return `<p class="muted">Aucun média enregistré.</p>`;
    const canDelete = currentUser.role !== "CLIENT";
    const selectionHelp = allowPdfSelection && photos.length
        ? '<p class="field-help">Cochez les photos à inclure dans le prochain PDF.</p>'
        : "";
    return `<div class="field"><label>Photos et signature enregistrées</label>${selectionHelp}<div class="media-grid">${photos.map((photo) => `<div class="media-item"><a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(photo.url)}" alt="Photo du rapport" style="transform:rotate(${Number(photo.rotation) || 0}deg)"></a>${allowPdfSelection ? `<label class="media-pdf-choice"><input type="checkbox" data-pdf-photo-id="${photo.id}" checked> Inclure au PDF</label>` : ""}${canDelete ? `<button class="secondary" type="button" data-annotate-photo="${photo.id}">✎ Annoter</button><button class="secondary" type="button" data-rotate-photo="${photo.id}" title="Faire pivoter la photo">↻ Pivoter</button><button class="media-delete" data-delete-photo="${photo.id}" aria-label="Supprimer cette photo" title="Supprimer la photo">${icon("trash")}</button>` : ""}</div>`).join("")}${item.signature_url ? `<div class="media-item signature"><a href="${escapeHtml(item.signature_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.signature_url)}" alt="Signature du client"></a>${canDelete ? `<button class="media-delete" data-delete-signature="${item.id}" aria-label="Supprimer la signature" title="Supprimer la signature">${icon("trash")}</button>` : ""}</div>` : ""}</div></div>`;
}
function bindMediaActions(item) {
    document.querySelectorAll("[data-annotate-photo]").forEach((button) => button.addEventListener("click", () => {
        const photo = (item.photos || []).find((entry) => String(entry.id) === String(button.dataset.annotatePhoto));
        if (photo) openPhotoAnnotator(item, photo);
    }));
    document.querySelectorAll("[data-rotate-photo]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        const photo = (item.photos || []).find((entry) => String(entry.id) === String(button.dataset.rotatePhoto));
        if (!photo) return;
        try {
            const result = await api(`/uploads/photo/${photo.id}/rotation`, { method: "PATCH", body: JSON.stringify({ rotation: ((Number(photo.rotation) || 0) + 90) % 360 }) });
            Object.assign(photo, result.photo);
            openIntervention(item.id);
            toast("Photo pivotée.");
        } catch (error) { toast(error.message, true); }
    })));
    document.querySelectorAll("[data-delete-photo]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        if (!confirm("Supprimer définitivement cette photo ?")) return;
        try {
            await api(`/uploads/photo/${button.dataset.deletePhoto}`, { method: "DELETE" });
            item.photos = (item.photos || []).filter((photo) => String(photo.id) !== String(button.dataset.deletePhoto));
            item.nombre_photos = item.photos.length;
            openIntervention(item.id);
            toast("Photo supprimée.");
        } catch (error) { toast(error.message, true); }
    })));
    document.querySelectorAll("[data-delete-signature]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        if (!confirm("Supprimer définitivement la signature ?")) return;
        try {
            await api(`/uploads/signature/${item.id}`, { method: "DELETE" });
            item.signature_url = null;
            openIntervention(item.id);
            toast("Signature supprimée.");
        } catch (error) { toast(error.message, true); }
    })));
}

async function openPhotoAnnotator(item, photo) {
    modal("Annoter la photo", `<div class="field"><label>Couleur du trait</label><input id="annotation-color" type="color" value="#ef4444"></div><canvas id="photo-annotation-canvas" class="canvas" style="height:auto;max-height:65vh"></canvas><div class="actions"><button class="secondary" id="reset-photo-annotation" type="button">Effacer les annotations</button><button class="primary" id="save-photo-annotation" type="button">Enregistrer l’image</button></div>`);
    const canvas = document.getElementById("photo-annotation-canvas");
    const context = canvas.getContext("2d");
    try {
        const response = await fetch(photo.url, { credentials: "include" });
        if (!response.ok) throw new Error("Impossible de charger la photo.");
        const bitmap = await createImageBitmap(await response.blob());
        const rotation = Number(photo.rotation) || 0;
        const rotated = rotation === 90 || rotation === 270;
        const sourceWidth = rotated ? bitmap.height : bitmap.width;
        const sourceHeight = rotated ? bitmap.width : bitmap.height;
        const scale = Math.min(1, 1200 / sourceWidth, 900 / sourceHeight);
        canvas.width = Math.round(sourceWidth * scale);
        canvas.height = Math.round(sourceHeight * scale);
        const drawBase = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.save();
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate(rotation * Math.PI / 180);
            context.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale / 2, bitmap.width * scale, bitmap.height * scale);
            context.restore();
        };
        drawBase();
        let drawing = false;
        const point = (event) => { const box = canvas.getBoundingClientRect(); return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height }; };
        canvas.addEventListener("pointerdown", (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
        canvas.addEventListener("pointermove", (event) => { if (!drawing) return; const p = point(event); context.strokeStyle = document.getElementById("annotation-color").value; context.lineWidth = Math.max(4, canvas.width / 180); context.lineCap = "round"; context.lineJoin = "round"; context.lineTo(p.x, p.y); context.stroke(); });
        canvas.addEventListener("pointerup", () => { drawing = false; });
        document.getElementById("reset-photo-annotation").addEventListener("click", drawBase);
        document.getElementById("save-photo-annotation").addEventListener("click", (event) => withBusy(event.currentTarget, async () => {
            try {
                const result = await api(`/uploads/photo/${photo.id}/image`, { method: "PATCH", body: JSON.stringify({ imageData: canvas.toDataURL("image/png") }) });
                Object.assign(photo, result.photo);
                openIntervention(item.id);
                toast("Photo annotée enregistrée.");
            } catch (error) { toast(error.message, true); }
        }));
    } catch (error) {
        closeModal();
        toast(error.message, true);
    }
}
function pdfButton(item, usePhotoSelection = false) { return `<p><button class="primary wide" data-download-pdf="${item.id}" ${usePhotoSelection ? "data-use-photo-selection" : ""}>${icon("download")} Exporter le rapport en PDF</button></p>`; }
function emailButton(item) { return googleMailStatus.connection ? `<p><button class="secondary wide" type="button" data-email-report="${item.id}">✉ Envoyer avec ${escapeHtml(googleMailStatus.connection.email_google)}</button></p>` : ""; }

function bindReportEmail(item) {
    document.querySelector(`[data-email-report="${item.id}"]`)?.addEventListener("click", () => openReportEmail(item));
}

function openReportEmail(item) {
    const selectedPhotoIds = [...document.querySelectorAll("[data-pdf-photo-id]:checked")].map((input) => Number(input.dataset.pdfPhotoId));
    const client = clients.find((entry) => String(entry.id) === String(item.client_id));
    const savedEmails = [...new Set([...(client?.report_emails || []), ...(client?.contact_report_emails || []), client?.email].filter(Boolean))];
    modal("Envoyer le rapport", `<form id="report-email-form"><div class="field"><label>Destinataires enregistrés</label><div class="checkbox-options">${savedEmails.length ? savedEmails.map((email) => `<label><input type="checkbox" name="saved_recipient" value="${escapeHtml(email)}" checked> ${escapeHtml(email)}</label>`).join("") : '<span class="muted">Aucune adresse enregistrée.</span>'}</div></div><div class="field"><label>Adresses libres supplémentaires</label><textarea name="free_recipients" rows="3" placeholder="Une adresse par ligne"></textarea></div><div class="field"><label>Objet</label><input name="subject" value="${escapeHtml(`Rapport ${item.titre}`)}"></div><div class="field"><label>Message</label><textarea name="message" rows="5">Bonjour,\n\nVeuillez trouver ci-joint le rapport « ${escapeHtml(item.titre)} ».\n\nCordialement,\n${escapeHtml(currentEntreprise?.report_settings?.display_name || currentEntreprise?.nom || "")}</textarea></div><button class="primary wide" type="submit">Envoyer avec le PDF</button></form>`);
    document.getElementById("report-email-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        const freeRecipients = parseEmailList(form.elements.free_recipients.value);
        const recipients = [...form.querySelectorAll('[name="saved_recipient"]:checked')].map((input) => input.value).concat(freeRecipients);
        await withBusy(button, async () => {
            try {
                await api(`/interventions/${item.id}/email`, { method: "POST", body: JSON.stringify({ recipients, free_recipients: freeRecipients, photo_ids: selectedPhotoIds, subject: form.elements.subject.value, message: form.elements.message.value }) });
                closeModal();
                toast("Rapport envoyé par e-mail.");
            } catch (error) { toast(error.message, true); }
        });
    });
}
function bindPdfDownload() {
    document.querySelectorAll("[data-download-pdf]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        try {
            const selectedPhotoIds = button.hasAttribute("data-use-photo-selection")
                ? [...document.querySelectorAll("[data-pdf-photo-id]:checked")].map((input) => input.dataset.pdfPhotoId)
                : null;
            const query = selectedPhotoIds === null ? "" : `?photo_ids=${encodeURIComponent(selectedPhotoIds.join(","))}`;
            const response = await fetch(`${API_URL}/interventions/${button.dataset.downloadPdf}/pdf${query}`, { credentials: "include" });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Impossible de générer le PDF.");
            }
            const objectUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `rapport-intervention-${button.dataset.downloadPdf}.pdf`;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            toast("Rapport PDF téléchargé.");
        } catch (error) { toast(error.message, true); }
    })));
}
function statusLabel(status) { return ({ PLANIFIEE: "Planifiée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée" })[status] || status; }
function equipmentLabel(item) { return [item.equipement_type, item.equipement_marque, item.equipement_modele, item.equipement_numero_serie].filter(Boolean).join(" · ") || "Non renseigné"; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "Non planifiée"; }
function localDateKey(value) { const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function formatMoney(value, currency = "EUR") { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0)); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function toast(message, bad = false) { document.querySelector(".toast")?.remove(); const node = document.createElement("div"); node.className = `toast ${bad ? "bad" : ""}`; node.setAttribute("role", bad ? "alert" : "status"); node.innerHTML = `${icon(bad ? "alert" : "check")}<span>${escapeHtml(message)}</span>`; document.body.append(node); setTimeout(() => node.remove(), 3500); }
