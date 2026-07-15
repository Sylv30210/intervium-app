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

const app = document.getElementById("app");
const THEME_STORAGE_KEY = "intervium_visual_theme";
applyStoredTheme();

const styles = `
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f3f6fb;color:#182234}button,input,select,textarea{font:inherit;font-size:16px}button{cursor:pointer;min-height:44px;transition:all .2s ease-in-out}button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.03)}button:active:not(:disabled){transform:translateY(0) scale(.97)}button:disabled{cursor:wait;opacity:.72}.hidden{display:none!important}.brand-lockup{display:inline-flex;align-items:center;gap:10px;color:inherit;font-size:28px;font-weight:850;letter-spacing:-.7px}.brand-mark{width:34px;height:34px;flex:none;color:currentColor}.brand-lockup.auth-logo{color:#2563eb}.brand-lockup.compact{font-size:19px;gap:8px}.brand-lockup.compact .brand-mark{width:28px;height:28px}
.auth{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#eff6ff,#f8fafc)}.auth-card{width:min(460px,100%);background:white;border-radius:20px;padding:30px;box-shadow:0 20px 60px #1e3a5f20;animation:modal-in .3s ease-out}.tabs{display:flex;gap:8px;margin:22px 0}.tabs button{flex:1;border:0;border-radius:10px;padding:10px;background:#eaf0f8}.tabs button.active{background:#2563eb;color:white}.field{display:grid;gap:6px;margin:12px 0}.field label{font-size:13px;font-weight:700;color:#475569}.field input,.field select,.field textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px;background:white;transition:border-color .2s ease,box-shadow .2s ease}.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px #2563eb18}.primary,.danger,.secondary{border:0;border-radius:10px;padding:10px 14px;font-weight:700}.primary{background:#2563eb;color:white}.secondary{background:#e7eef8;color:#29415f}.danger{background:#fee2e2;color:#b91c1c}.wide{width:100%}.error{color:#b91c1c;background:#fef2f2;padding:10px;border-radius:8px;margin:10px 0}
.shell{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.sidebar{background:#10233f;color:white;padding:24px;display:flex;flex-direction:column;gap:24px}.sidebar .brand{color:white}.nav button{display:block;width:100%;text-align:left;background:transparent;color:#cbd5e1;border:0;padding:11px;border-radius:9px}.nav button.active,.nav button:hover{background:#ffffff18;color:white}.profile{margin-top:auto;font-size:13px;color:#cbd5e1}.mobile-header,.bottom-nav{display:none}.main{padding:28px;overflow:auto}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.topbar h1{margin:0}.muted{color:#64748b;font-size:13px}.stats{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:14px}.stat,.panel{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:18px}.stat strong{font-size:28px;display:block;margin-top:5px}.panel{margin-top:18px}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.panel h2{font-size:18px;margin:0}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:650px}th,td{text-align:left;padding:11px;border-bottom:1px solid #edf1f7;font-size:14px}th{color:#64748b;font-size:12px;text-transform:uppercase}.badge{display:inline-block;border-radius:999px;padding:5px 9px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700}.badge.off{background:#e2e8f0;color:#475569}.actions{display:flex;gap:7px;flex-wrap:wrap}.empty{text-align:center;color:#64748b;padding:28px}
.modal-backdrop{position:fixed;inset:0;background:#0f172a88;display:grid;place-items:center;padding:20px;z-index:20;animation:backdrop-in .22s ease-out}.modal{background:white;border-radius:16px;padding:22px;width:min(680px,100%);max-height:92dvh;overflow:auto;animation:modal-in .24s ease-out}.modal-head{display:flex;justify-content:space-between;align-items:center;position:sticky;top:-22px;background:white;z-index:2;padding:10px 0}.modal-head h2{margin:0}.close{border:0;background:transparent;font-size:28px;min-width:48px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.canvas{display:block;width:100%;height:180px;max-width:100%;border:2px dashed #94a3b8;border-radius:12px;touch-action:none;background:white}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.media-item{position:relative;min-width:0;transition:transform .2s ease,box-shadow .2s ease}.media-item:hover{transform:translateY(-2px)}.media-item img{display:block;width:100%;height:130px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;background:white}.media-item.signature img{object-fit:contain}.media-delete{position:absolute;top:7px;right:7px;min-height:40px;min-width:40px;border:0;border-radius:999px;background:#dc2626;color:white;font-size:18px;box-shadow:0 3px 10px #0004}.toast{position:fixed;right:20px;bottom:20px;max-width:min(420px,calc(100vw - 32px));background:#172554;color:white;padding:12px 16px;border-radius:10px;z-index:50;animation:toast-in .24s ease-out}.toast.bad{background:#991b1b}#view{animation:view-in .24s ease-out}.spinner{display:inline-block;width:18px;height:18px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-3px}.spinner.large{width:30px;height:30px;border-width:3px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.app-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#eff6ff,#f8fafc)}.loading-card{width:min(360px,calc(100% - 32px));display:grid;justify-items:center;gap:18px;background:white;padding:28px;border-radius:20px;box-shadow:0 18px 55px #1e3a5f1c}.skeletons{width:100%;display:grid;gap:9px}.skeleton{height:12px;border-radius:99px;background:linear-gradient(90deg,#e8eef6 25%,#f8fafc 50%,#e8eef6 75%);background-size:200% 100%;animation:shimmer 1.2s ease-in-out infinite}.skeleton:nth-child(2){width:78%}.skeleton:nth-child(3){width:58%}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{to{background-position:-200% 0}}@keyframes view-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes backdrop-in{from{opacity:0}to{opacity:1}}@keyframes modal-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@keyframes drawer-up{from{transform:translateY(100%);opacity:.4}to{transform:translateY(0);opacity:1}}@keyframes toast-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media(max-width:768px){body{background:#f7f9fc}.shell{display:block;min-height:100dvh}.sidebar{display:none}.mobile-header{display:flex;position:fixed;inset:0 0 auto 0;height:54px;padding:0 14px;align-items:center;justify-content:space-between;background:#10233f;color:white;z-index:15;box-shadow:0 2px 12px #0f172a24}.mobile-brand{font-size:19px;font-weight:850;letter-spacing:-.3px}.mobile-user{display:flex;align-items:center;gap:9px;min-width:0}.mobile-user-name{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#dbeafe}.mobile-logout{border:1px solid #ffffff30;background:#ffffff12;color:white;border-radius:999px;width:40px;min-width:40px;height:40px;min-height:40px;padding:0;font-size:19px}.bottom-nav{display:flex;position:fixed;inset:auto 0 0 0;height:calc(66px + env(safe-area-inset-bottom));padding:5px 4px env(safe-area-inset-bottom);align-items:stretch;background:#fff;border-top:1px solid #dbe3ee;box-shadow:0 -5px 20px #0f172a16;z-index:16}.bottom-nav button{flex:1;min-width:0;min-height:56px;border:0;background:transparent;color:#64748b;border-radius:12px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.bottom-nav button.active{color:#1d4ed8;background:#eff6ff}.bottom-nav .nav-icon{font-size:20px;line-height:1}.bottom-nav .nav-label{font-size:9.5px;line-height:1.1;font-weight:750;max-width:100%;overflow:hidden;text-overflow:ellipsis}.main{min-height:100dvh;padding:70px 14px calc(82px + env(safe-area-inset-bottom));overflow:visible}.topbar{align-items:center;gap:10px;margin-bottom:14px}.topbar h1{font-size:23px;line-height:1.15}.topbar .muted{display:none}.topbar>.primary{white-space:nowrap;padding-inline:13px}.stats{grid-template-columns:1fr 1fr;gap:10px}.stat,.panel{padding:14px}.panel{margin-top:12px}.grid2{grid-template-columns:1fr}.modal-backdrop{padding:0;align-items:end;z-index:30}.modal{width:100%;max-height:calc(100dvh - 30px);border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));animation:drawer-up .22s ease-out}.modal-head{top:-18px}.actions{display:grid;grid-template-columns:1fr}.actions button,.actions a,.wide{width:100%}.canvas{height:160px}.table-wrap{overflow:visible}table,thead,tbody,tr,td{display:block;width:100%}table{min-width:0}thead{display:none}tbody{display:grid;gap:12px}tr{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px;box-shadow:0 4px 14px #0f172a0a}td{border:0;padding:7px 0;display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:start;overflow-wrap:anywhere}td::before{content:attr(data-label);font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800}td.actions{display:flex;grid-template-columns:none;margin-top:5px}.media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.toast{left:16px;right:16px;bottom:calc(78px + env(safe-area-inset-bottom))}}
@media(max-width:420px){.stats{grid-template-columns:1fr}.media-grid{grid-template-columns:1fr}.canvas{height:145px}.mobile-user-name{display:none}}
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
`;
document.head.insertAdjacentHTML("beforeend", `<style>${styles}</style>`);

document.addEventListener("DOMContentLoaded", initApp);

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

    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Une erreur est survenue.");
    return data;
}

async function initApp() {
    app.innerHTML = `<div class="app-loading"><div class="loading-card">${logoLockup("auth-logo")}<span class="spinner large" aria-hidden="true"></span><span class="sr-only">Chargement de l’application</span><div class="skeletons" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div></div>`;
    try {
        const session = await api("/auth/me");
        currentUser = session.user;
        currentEntreprise = session.entreprise;
        await loadAllData();
        renderMain("dashboard");
    } catch (error) {
        if (!currentUser) showAuth();
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
        </form>
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

function logoSvg() {
    return `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 3.5 41 10v12.6c0 10.2-6.7 18.3-17 21.9C13.7 40.9 7 32.8 7 22.6V10L24 3.5Z" fill="currentColor" opacity=".2"/><path d="M24 5.8 38.5 11v11.6c0 8.5-5.4 15.4-14.5 18.9-9.1-3.5-14.5-10.4-14.5-18.9V11L24 5.8Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m16.4 23.8 5 5 10.8-11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function logoLockup(extraClass = "") {
    return `<div class="brand-lockup ${extraClass}" aria-label="Intervium">${logoSvg()}<span>Intervium</span></div>`;
}

function storedTheme() {
    try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
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
        if (value !== "classic") localStorage.setItem(THEME_STORAGE_KEY, value);
        else localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
    return applyStoredTheme();
}

function authError(message) {
    const box = document.getElementById("auth-error");
    box.textContent = message;
    box.classList.remove("hidden");
}

async function handleLogin(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const button = event.currentTarget.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            await api("/auth/login", { method: "POST", body: JSON.stringify(values) });
            await initApp();
        } catch (error) { authError(error.message); }
    });
}

async function handleRegister(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const button = event.currentTarget.querySelector("button[type='submit']");
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
    app.innerHTML = `<div class="shell">
      <aside class="sidebar"><div>${logoLockup()}<div class="muted">${escapeHtml(currentEntreprise?.nom || "")}</div></div>
        <nav class="nav">${navButton("dashboard", "Tableau de bord", view)}${navButton("interventions", currentUser.role === "CLIENT" ? "Rapports" : "Interventions", view)}${currentUser.role === "CLIENT" ? "" : `${navButton("planning", "Planning", view)}${navButton("clients", "Clients", view)}${navButton("equipements", "Équipements", view)}${navButton("modeles", "Modèles de rapport", view)}`}${currentUser.role === "ADMIN" ? `${navButton("documents", "Devis & factures", view)}${navButton("equipe", "Équipe", view)}` : ""}</nav>
        <div class="profile"><strong>${escapeHtml(currentUser.nom)}</strong><br>${escapeHtml(currentUser.role)}<div class="profile-actions"><button id="desktop-settings" class="icon-button">⚙ Paramètres</button><button id="desktop-logout" class="secondary">Déconnexion</button></div></div>
      </aside>
      <header class="mobile-header">${logoLockup("compact mobile-brand")}<div class="mobile-user"><span class="mobile-user-name">${escapeHtml(currentUser.nom)}</span><button id="mobile-settings" class="mobile-settings" aria-label="Ouvrir les paramètres" title="Paramètres">⚙</button><button id="mobile-logout" class="mobile-logout" aria-label="Se déconnecter" title="Déconnexion">↪</button></div></header>
      <main class="main"><header class="topbar"><div><h1>${titleFor(view)}</h1><div class="muted">Données de ${escapeHtml(currentEntreprise?.nom || "votre entreprise")}</div></div>${adminButtonFor(view)}</header><div id="view">${renderView(view)}</div></main>
      <nav class="bottom-nav" aria-label="Navigation principale">${mobileNavButton("dashboard", "⌂", "Accueil", view)}${mobileNavButton("interventions", "▣", currentUser.role === "CLIENT" ? "Rapports" : "Missions", view)}${currentUser.role === "CLIENT" ? "" : `${mobileNavButton("planning", "▦", "Planning", view)}${mobileNavButton("clients", "♙", "Clients", view)}<button id="mobile-more" aria-label="Plus de rubriques"><span class="nav-icon" aria-hidden="true">•••</span><span class="nav-label">Plus</span></button>`}</nav>
    </div><div id="modal-root"></div>`;

    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => renderMain(button.dataset.view)));
    document.getElementById("desktop-logout").addEventListener("click", logout);
    document.getElementById("mobile-logout").addEventListener("click", logout);
    document.getElementById("desktop-settings").addEventListener("click", openSettings);
    document.getElementById("mobile-settings").addEventListener("click", openSettings);
    document.getElementById("mobile-more")?.addEventListener("click", openMoreMenu);
    bindMainActions(view);
}

function navButton(view, label, active) { return `<button data-view="${view}" class="${view === active ? "active" : ""}">${label}</button>`; }
function mobileNavButton(view, icon, label, active) { return `<button data-view="${view}" class="${view === active ? "active" : ""}" aria-label="${label}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${label}</span></button>`; }
function titleFor(view) { return ({ dashboard: "Tableau de bord", interventions: currentUser.role === "CLIENT" ? "Rapports" : "Interventions", planning: "Planning", clients: "Clients", equipements: "Équipements", modeles: "Modèles de rapport", documents: "Devis & factures", equipe: "Équipe" })[view] || "Intervium"; }
function adminButtonFor(view) {
    const canAdd = currentUser.role === "ADMIN" ||
        (currentUser.role === "TECHNICIEN" && ["interventions", "planning"].includes(view));
    if (!canAdd || view === "dashboard") return "";
    if (view === "modeles" && currentUser.role !== "ADMIN") return "";
    if (view === "documents" && currentUser.role !== "ADMIN") return "";
    return `<button class="primary" id="add-${view}">+ Ajouter</button>`;
}

function renderView(view) {
    if (view === "dashboard") return renderDashboard();
    if (view === "interventions") return renderInterventions();
    if (view === "planning") return renderPlanning();
    if (view === "clients") return renderClients();
    if (view === "equipements") return renderEquipements();
    if (view === "modeles") return renderTemplates();
    if (view === "documents") return renderDocuments();
    return renderTeam();
}

function renderDashboard() {
    const finished = interventions.filter((item) => item.statut === "TERMINEE").length;
    const quickActions = currentUser.role === "CLIENT" ? "" : `<section class="quick-actions"><button class="primary" data-quick-action="intervention">＋ Nouvelle intervention</button><button class="secondary" data-quick-view="planning">▦ Ouvrir le planning</button><button class="secondary" data-quick-view="modeles">▤ Modèles de rapport</button>${currentUser.role === "ADMIN" ? `<button class="secondary" data-quick-view="documents">€ Devis et factures</button>` : ""}</section>`;
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
    return `<section class="panel"><div class="panel-head"><div><h2>Modèles réutilisables</h2><p class="muted">Les champs du modèle apparaissent lors de la création et dans le PDF du rapport.</p></div></div><div class="template-list">${reportTemplates.map((template) => `<article class="template-card"><div><strong>${escapeHtml(template.nom)}</strong><div class="muted">${escapeHtml(template.description || "Sans description")} · ${(template.sections || []).length} bloc(s)</div></div>${currentUser.role === "ADMIN" ? `<div class="actions"><button class="secondary" data-edit-template="${template.id}">Configurer</button><button class="danger" data-delete-template="${template.id}">Supprimer définitivement</button></div>` : ""}</article>`).join("")}</div></section>`;
}

function renderDocuments() {
    const total = commercialDocuments.reduce((sum, document) => sum + Number(document.total_ttc || 0), 0);
    const paid = commercialDocuments.filter((document) => document.statut === "PAYE").reduce((sum, document) => sum + Number(document.total_ttc || 0), 0);
    return `<section class="stats"><div class="stat"><span class="muted">Documents</span><strong>${commercialDocuments.length}</strong></div><div class="stat"><span class="muted">Total TTC</span><strong>${formatMoney(total)}</strong></div><div class="stat"><span class="muted">Payé</span><strong>${formatMoney(paid)}</strong></div><div class="stat"><span class="muted">À encaisser</span><strong>${formatMoney(total - paid)}</strong></div></section><section class="panel"><div class="document-list">${commercialDocuments.length ? commercialDocuments.map((document) => `<article class="document-card"><div><strong>${escapeHtml(document.numero || document.type)}</strong><div class="muted">${escapeHtml(document.client_nom)} · ${formatDate(document.date_emission)} · ${escapeHtml(document.statut)}</div></div><div class="actions"><strong>${formatMoney(document.total_ttc, document.devise)}</strong><button class="secondary" data-open-document="${document.id}">Voir</button><button class="danger" data-delete-document="${document.id}">Supprimer</button></div></article>`).join("") : `<div class="empty">Aucun devis ou facture.</div>`}</div></section>`;
}
function interventionTable(items, actions) {
    if (!items.length) return `<div class="empty">Aucune intervention.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Équipement</th><th>Intervention</th><th>Technicien</th><th>Statut</th>${actions ? "<th>Actions</th>" : ""}</tr></thead><tbody>${items.map((item) => `<tr><td data-label="Date">${formatDate(item.date_intervention)} ${escapeHtml(item.heure?.slice(0,5) || "")}</td><td data-label="Client">${escapeHtml(item.client_nom)}</td><td data-label="Équipement">${escapeHtml(equipmentLabel(item))}</td><td data-label="Intervention">${escapeHtml(item.titre)}</td><td data-label="Technicien">${escapeHtml(item.technicien_nom || "Non assigné")}</td><td data-label="Statut"><span class="badge">${statusLabel(item.statut)}</span></td>${actions ? `<td data-label="Actions" class="actions"><button class="secondary" data-edit-intervention="${item.id}">Ouvrir</button>${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-intervention="${item.id}">Supprimer</button>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function renderClients() {
    if (!clients.length) return `<section class="panel"><div class="empty">Aucun client.</div></section>`;
    return `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th></th></tr></thead><tbody>${clients.map((c) => `<tr><td data-label="Nom">${escapeHtml(c.nom)}</td><td data-label="Email">${escapeHtml(c.email || "—")}</td><td data-label="Téléphone">${escapeHtml(c.telephone || "—")}</td><td data-label="Adresse">${escapeHtml(c.adresse || "—")}</td><td data-label="Actions">${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-client="${c.id}">Supprimer</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function renderEquipements() {
    if (!equipements.length) return `<section class="panel"><div class="empty">Aucun équipement.</div></section>`;
    return `<section class="panel"><div class="table-wrap"><table><thead><tr><th>Client</th><th>Type</th><th>Modèle</th><th>N° série</th><th></th></tr></thead><tbody>${equipements.map((e) => `<tr><td data-label="Client">${escapeHtml(e.client_nom)}</td><td data-label="Type">${escapeHtml(e.type || "—")}</td><td data-label="Modèle">${escapeHtml(e.modele || "—")}</td><td data-label="N° série">${escapeHtml(e.numero_serie || "—")}</td><td data-label="Actions">${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-equipment="${e.id}">Supprimer</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
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
    document.querySelectorAll("[data-quick-view]").forEach((button) => button.addEventListener("click", () => renderMain(button.dataset.quickView)));
    document.querySelector("[data-quick-action='intervention']")?.addEventListener("click", openNewIntervention);
    document.getElementById("planning-prev")?.addEventListener("click", () => { planningCursor = new Date(planningCursor.getFullYear(), planningCursor.getMonth() - 1, 1); renderMain("planning"); });
    document.getElementById("planning-next")?.addEventListener("click", () => { planningCursor = new Date(planningCursor.getFullYear(), planningCursor.getMonth() + 1, 1); renderMain("planning"); });
    document.querySelectorAll("[data-edit-intervention]").forEach((b) => b.addEventListener("click", () => openIntervention(b.dataset.editIntervention)));
    document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => openTemplateEditor(button.dataset.editTemplate)));
    document.querySelectorAll("[data-delete-template]").forEach((button) => button.addEventListener("click", () => deleteTemplate(button.dataset.deleteTemplate, button)));
    document.querySelectorAll("[data-open-document]").forEach((button) => button.addEventListener("click", () => openDocumentDetails(button.dataset.openDocument)));
    document.querySelectorAll("[data-delete-document]").forEach((button) => button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument, button)));
    bindDeletes("intervention", "/interventions", "interventions");
    bindDeletes("client", "/clients", "clients");
    bindDeletes("equipment", "/equipements", "equipements");
    bindTeamActions();
}

function openMoreMenu() {
    const items = [
        ["equipements", "◇ Équipements"],
        ["modeles", "▤ Modèles de rapport"],
        ...(currentUser.role === "ADMIN" ? [["documents", "€ Devis & factures"], ["equipe", "♟ Équipe"]] : []),
    ];
    modal("Plus de rubriques", `<div class="more-menu">${items.map(([view, label]) => `<button class="secondary" data-more-view="${view}">${label}</button>`).join("")}</div>`);
    document.querySelectorAll("[data-more-view]").forEach((button) => button.addEventListener("click", () => renderMain(button.dataset.moreView)));
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
    document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop"><section class="modal"><header class="modal-head"><h2>${title}</h2><button class="close" id="close-modal">×</button></header>${content}</section></div>`;
    document.getElementById("close-modal").addEventListener("click", closeModal);
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

function openSettings() {
    const activeTheme = document.documentElement.dataset.theme || "classic";
    const reportSettings = currentEntreprise?.report_settings || {};
    const companySettings = currentUser.role === "ADMIN" ? `
        <form id="company-report-settings" class="company-branding">
          <div class="panel-head"><div><h2>Identité des rapports PDF</h2><p class="muted">Ces informations remplacent entièrement la marque Intervium dans vos documents.</p></div></div>
          <div class="company-logo-preview">${currentEntreprise?.logo_url ? `<img src="${escapeHtml(currentEntreprise.logo_url)}" alt="Logo actuel de l’entreprise">` : `<span class="muted">Aucun logo d’entreprise</span>`}</div>
          <div class="field"><label for="company-logo-file">Logo (PNG, JPEG ou WebP - 5 Mo maximum)</label><input id="company-logo-file" type="file" accept="image/png,image/jpeg,image/webp"></div>
          ${currentEntreprise?.logo_url ? `<button class="danger" id="remove-company-logo" type="button">Supprimer le logo actuel</button>` : ""}
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
            <label class="theme-option"><input type="radio" name="visual-theme" value="classic" ${activeTheme === "classic" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon" aria-hidden="true">☀</span><span>Classique</span></span></label>
            <label class="theme-option"><input type="radio" name="visual-theme" value="glass" ${activeTheme === "glass" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon" aria-hidden="true">◌</span><span>Liquid Glass</span></span></label>
            <label class="theme-option"><input type="radio" name="visual-theme" value="dark" ${activeTheme === "dark" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon" aria-hidden="true">☾</span><span>Sombre</span></span></label>
        </div>
        <p class="muted">Cette préférence visuelle est enregistrée uniquement sur cet appareil.</p>
        ${companySettings}
    `);

    document.querySelectorAll('input[name="visual-theme"]').forEach((input) => input.addEventListener("change", (event) => {
        const theme = setTheme(event.target.value);
        toast(({ classic: "Thème classique activé.", glass: "Mode Liquid Glass activé.", dark: "Thème sombre activé." })[theme]);
    }));
    document.getElementById("company-report-settings")?.addEventListener("submit", saveCompanyReportSettings);
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

async function saveCompanyReportSettings(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    await withBusy(button, async () => {
        try {
            const logoFile = document.getElementById("company-logo-file")?.files[0];
            if (logoFile) {
                const logoData = new FormData();
                logoData.append("logo", logoFile);
                const logoResult = await api("/uploads/company-logo", { method: "POST", body: logoData });
                currentEntreprise = logoResult.entreprise;
            }
            const values = Object.fromEntries(new FormData(event.currentTarget));
            values.show_intervium = event.currentTarget.elements.show_intervium.checked;
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

function openTemplateEditor(id = null) {
    const existing = reportTemplates.find((template) => String(template.id) === String(id));
    templateDraftSections = (existing?.sections || []).map((section) => ({
        ...newTemplateSection(section.type, section.label, section.key),
        ...section,
        options: [...(section.options || [])],
        columns: [...(section.columns || [])],
    }));
    modal(existing ? "Configurer le modèle" : "Nouveau modèle de rapport", `<form id="template-form">
      ${field("Nom du modèle", "template-name", "text", true, existing?.nom || "")}
      <div class="field"><label for="template-description">Description</label><textarea id="template-description" rows="2">${escapeHtml(existing?.description || "")}</textarea></div>
      <div class="builder-palette">${TEMPLATE_FIELD_TYPES.map(([type, label]) => `<button type="button" class="secondary" data-add-template-field="${type}">＋ ${label}</button>`).join("")}</div>
      <div id="template-fields" class="template-fields"></div>
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
        columns: type === "price_table" ? ["Désignation", "Quantité", "Prix HT", "TVA %"] : type === "table" ? ["Colonne 1", "Colonne 2"] : [],
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
        fields.push(`<div class="field full"><label>Choix proposés, séparés par des virgules</label><input ${property("options", (section.options || []).join(", "), "list")} placeholder="Conforme, Non conforme, Non applicable"></div>`);
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
        fields.push(`<div class="field full"><label>Colonnes, séparées par des virgules</label><input ${property("columns", (section.columns || []).join(", "), "list")} placeholder="Désignation, Quantité, Observation"></div>`);
    }
    if (["photo", "multi_photo", "event_photos"].includes(section.type)) {
        fields.push(`<div class="field"><label>Nombre maximum de photos</label><input type="number" min="1" max="20" ${property("maxPhotos", section.maxPhotos || (section.type === "photo" ? 1 : 5), "number")}></div>`);
    }
    return fields.join("");
}

function renderTemplateDraft() {
    const container = document.getElementById("template-fields");
    if (!container) return;
    container.innerHTML = templateDraftSections.length ? templateDraftSections.map((section, index) => `<article class="template-field-row">
      <div class="template-field-toolbar"><strong>Bloc ${index + 1}</strong><span class="muted">Clé : ${escapeHtml(section.key)}</span></div>
      <div class="template-field-config">
        <div class="field"><label>Libellé affiché</label><input data-template-property="label" data-template-index="${index}" value="${escapeHtml(section.label)}" maxlength="150"></div>
        <div class="field"><label>Type de bloc</label><select data-template-type="${index}">${TEMPLATE_FIELD_TYPES.map(([type, label]) => `<option value="${type}" ${type === section.type ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></div>
        ${!["title", "page_break"].includes(section.type) ? `<div class="field full"><label>Texte d’aide</label><input data-template-property="helpText" data-template-index="${index}" value="${escapeHtml(section.helpText || "")}" placeholder="Consigne affichée sous le champ"></div><div class="field"><label>Largeur</label><select data-template-property="width" data-template-index="${index}"><option value="full" ${section.width !== "half" ? "selected" : ""}>Toute la largeur</option><option value="half" ${section.width === "half" ? "selected" : ""}>Demi-largeur</option></select></div>` : ""}
        ${templateSpecificConfiguration(section, index)}
      </div>
      <div class="template-field-actions">${templateFieldSupportsRequired(section.type) ? `<label class="muted"><input type="checkbox" data-required-template="${index}" ${section.required ? "checked" : ""}> Champ obligatoire</label>` : ""}<button type="button" class="secondary" data-move-template-up="${index}" ${index === 0 ? "disabled" : ""}>↑ Monter</button><button type="button" class="secondary" data-move-template-down="${index}" ${index === templateDraftSections.length - 1 ? "disabled" : ""}>↓ Descendre</button><button type="button" class="danger" data-remove-template-field="${index}">Retirer</button></div>
    </article>`).join("") : `<div class="empty">Ajoutez les blocs qui composeront ce rapport.</div>`;
    container.querySelectorAll("[data-template-property]").forEach((input) => {
        const eventName = input.tagName === "SELECT" ? "change" : "input";
        input.addEventListener(eventName, () => {
            const section = templateDraftSections[Number(input.dataset.templateIndex)];
            const kind = input.dataset.valueKind;
            section[input.dataset.templateProperty] = kind === "list"
                ? input.value.split(",").map((entry) => entry.trim()).filter(Boolean)
                : kind === "number" ? Number(input.value)
                : kind === "nullable-number" ? (input.value === "" ? null : Number(input.value))
                : input.value;
            renderTemplatePreview();
        });
    });
    container.querySelectorAll("[data-template-type]").forEach((select) => select.addEventListener("change", () => {
        const index = Number(select.dataset.templateType);
        const previous = templateDraftSections[index];
        const label = TEMPLATE_FIELD_TYPES.find(([type]) => type === select.value)?.[1] || previous.label;
        templateDraftSections[index] = { ...newTemplateSection(select.value, previous.label || label, previous.key), helpText: previous.helpText || "", width: previous.width || "full" };
        renderTemplateDraft();
    }));
    container.querySelectorAll("[data-required-template]").forEach((input) => input.addEventListener("change", () => { templateDraftSections[Number(input.dataset.requiredTemplate)].required = input.checked; renderTemplatePreview(); }));
    container.querySelectorAll("[data-move-template-up]").forEach((button) => button.addEventListener("click", () => moveTemplateField(Number(button.dataset.moveTemplateUp), -1)));
    container.querySelectorAll("[data-move-template-down]").forEach((button) => button.addEventListener("click", () => moveTemplateField(Number(button.dataset.moveTemplateDown), 1)));
    container.querySelectorAll("[data-remove-template-field]").forEach((button) => button.addEventListener("click", () => { templateDraftSections.splice(Number(button.dataset.removeTemplateField), 1); renderTemplateDraft(); }));
    renderTemplatePreview();
}

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
    const button = event.currentTarget.querySelector("button[type='submit']");
    const payload = Object.fromEntries(new FormData(event.currentTarget));
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
    modal("Nouveau client", `<form id="client-form">${field("Nom", "nom", "text", true)}${field("Email", "email", "email")}${field("Téléphone", "telephone")}${field("Adresse", "adresse")}<button class="primary wide">Créer le client</button></form>`);
    document.getElementById("client-form").addEventListener("submit", async (event) => submitForm(event, "/clients", "clients"));
}

function openNewEquipment() {
    modal("Nouvel équipement", `<form id="equipment-form"><div class="field"><label>Client</label><select name="client_id" required>${clientOptions()}</select></div>${field("Type", "type")}${field("Modèle", "modele")}${field("Numéro de série", "numero_serie")}${field("Date d’installation", "date_installation", "date")}<button class="primary wide">Créer l’équipement</button></form>`);
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
    modal("Nouvelle intervention", `<form id="intervention-form"><div class="grid2"><div class="field"><label>Client</label><select id="new-client" name="client_id" required>${creationClientOptions(eligibleClients)}</select></div>${technicianField}</div><div class="field"><label>Équipement concerné</label><select id="new-equipment" name="equipement_id" required>${creationEquipmentOptions(firstClientId)}</select></div>${field("Titre", "titre", "text", true)}<div class="field"><label>Description</label><textarea name="description"></textarea></div><div class="grid2">${field("Date", "date_intervention", "date")}${field("Heure", "heure", "time")}</div><div class="field"><label>Modèle de rapport</label><select id="new-report-template" name="modele_rapport_id"><option value="">Rapport libre</option>${reportTemplates.filter((template) => template.actif).map((template) => `<option value="${template.id}">${escapeHtml(template.nom)}</option>`).join("")}</select></div><div id="new-report-fields"></div><button class="primary wide">Créer l’intervention</button></form>`);
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
        const button = event.currentTarget.querySelector("button[type='submit'], button:not([type])");
        const values = Object.fromEntries(new FormData(event.currentTarget));
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        values.donnees_rapport = collectReportData(event.currentTarget);
        await withBusy(button, async () => {
            try {
                await api("/interventions", { method: "POST", body: JSON.stringify(values) });
                closeModal();
                await finishMutation("interventions", "Intervention créée.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function renderReportFields(template, data = {}) {
    const sections = Array.isArray(template?.sections || template?.modele_rapport_sections) ? (template.sections || template.modele_rapport_sections) : [];
    if (!sections.length) return "";
    return `<section class="panel"><div class="panel-head"><div><h2>${escapeHtml(template.nom || template.modele_rapport_nom || "Rapport personnalisé")}</h2><p class="muted">Complétez les contrôles définis dans le modèle.</p></div></div><div class="report-fields-grid">${sections.map((section) => {
        const value = Object.hasOwn(data || {}, section.key) ? data[section.key] : (section.defaultValue ?? "");
        const attributes = `data-report-key="${escapeHtml(section.key)}" ${section.required ? "required" : ""}`;
        const label = `<label>${escapeHtml(section.label)}${section.required ? " *" : ""}</label>`;
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
        if (section.type === "select") return wrapper(`<div class="field">${label}<select ${attributes}><option value="">${escapeHtml(section.placeholder || "Sélectionner")}</option>${(section.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`);
        if (section.type === "checkbox" && (section.options || []).length) {
            const selected = Array.isArray(value) ? value : [];
            return wrapper(`<fieldset class="field"><legend>${escapeHtml(section.label)}${section.required ? " *" : ""}</legend><div class="checkbox-options">${section.options.map((option) => `<label><input type="checkbox" data-report-checkbox-group="${escapeHtml(section.key)}" value="${escapeHtml(option)}" ${selected.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div></fieldset>`);
        }
        if (section.type === "checkbox") return wrapper(`<div class="field"><label><input type="checkbox" ${attributes} ${value ? "checked" : ""}> ${escapeHtml(section.label)}${section.required ? " *" : ""}</label></div>`);
        const inputType = section.type === "date" ? (section.dateMode || "date") : section.type === "number" ? "number" : "text";
        const numberRules = section.type === "number" ? `${section.min !== null && section.min !== undefined ? `min="${Number(section.min)}"` : ""} ${section.max !== null && section.max !== undefined ? `max="${Number(section.max)}"` : ""} step="${Number(section.step || 1)}"` : "";
        return wrapper(`<div class="field">${label}<div class="actions"><input type="${inputType}" ${attributes} ${numberRules} value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(section.placeholder || "")}">${section.unit ? `<span class="muted">${escapeHtml(section.unit)}</span>` : ""}</div></div>`);
    }).join("")}</div></section>`;
}

function reportTableRow(columns, values = {}, priceTable = false) {
    return `<tr>${columns.map((column, index) => `<td data-label="${escapeHtml(column)}"><input data-table-column="c${index}" type="${priceTable && index > 0 ? "number" : "text"}" ${priceTable && index > 0 ? 'min="0" step="0.01"' : ""} value="${escapeHtml(values[`c${index}`] ?? "")}" aria-label="${escapeHtml(column)}"></td>`).join("")}<td data-label="Action"><button type="button" class="danger" data-remove-report-row aria-label="Supprimer la ligne">×</button></td></tr>`;
}

function renderReportTable(section, rows) {
    const columns = section.columns?.length ? section.columns : (section.type === "price_table" ? ["Désignation", "Quantité", "Prix HT", "TVA %"] : ["Colonne 1", "Colonne 2"]);
    const initialRows = rows.length ? rows : [{}];
    return `<div class="report-table field" data-report-table="${escapeHtml(section.key)}" data-columns="${escapeHtml(JSON.stringify(columns))}" data-price-table="${section.type === "price_table"}"><label>${escapeHtml(section.label)}${section.required ? " *" : ""}</label>${section.helpText ? `<span class="field-help">${escapeHtml(section.helpText)}</span>` : ""}<table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}<th></th></tr></thead><tbody>${initialRows.map((row) => reportTableRow(columns, row, section.type === "price_table")).join("")}</tbody></table><div class="report-table-actions"><button type="button" class="secondary" data-add-report-row>＋ Ajouter une ligne</button></div>${section.type === "price_table" ? `<div class="report-table-total">Total HT : <span>0,00 €</span></div>` : ""}</div>`;
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
            [...row.querySelectorAll("[data-table-column]")].map((input) => [input.dataset.tableColumn, input.type === "number" && input.value !== "" ? Number(input.value) : input.value.trim()])
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
        const priceTable = table.dataset.priceTable === "true";
        const recalculate = () => {
            if (!priceTable) return;
            const total = [...table.querySelectorAll("tbody tr")].reduce((sum, row) => {
                const inputs = row.querySelectorAll("[data-table-column]");
                return sum + Number(inputs[1]?.value || 0) * Number(inputs[2]?.value || 0);
            }, 0);
            table.querySelector(".report-table-total span").textContent = formatMoney(total);
        };
        table.addEventListener("click", (event) => {
            const remove = event.target.closest("[data-remove-report-row]");
            if (remove) {
                const rows = table.querySelectorAll("tbody tr");
                if (rows.length > 1) remove.closest("tr").remove();
                else remove.closest("tr").querySelectorAll("input").forEach((input) => { input.value = ""; });
                recalculate();
            }
            if (event.target.closest("[data-add-report-row]")) {
                table.querySelector("tbody").insertAdjacentHTML("beforeend", reportTableRow(columns, {}, priceTable));
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
    const submitButton = event.currentTarget.querySelector("button[type='submit'], button:not([type])");
    const values = Object.fromEntries(new FormData(event.currentTarget));
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
        modal("Rapport d’intervention", `<p><strong>${escapeHtml(item.titre)}</strong><br><span class="muted">${escapeHtml(item.client_nom)} · ${formatDate(item.date_intervention)}</span></p><p><span class="badge">${statusLabel(item.statut)}</span></p><div class="field"><label>Description</label><p>${escapeHtml(item.description || "Aucune description.")}</p></div><div class="field"><label>Compte-rendu</label><p>${escapeHtml(item.compte_rendu || "Compte-rendu non disponible.")}</p></div>${reportDataSummary(item)}${mediaGallery(item)}${pdfButton(item)}`);
        bindPdfDownload();
        return;
    }

    const selectedTemplateId = item.modele_rapport_id || (item.modele_rapport_sections?.length ? "__snapshot__" : "");
    const templateSelector = `<div class="field"><label>Modèle de rapport</label><select id="edit-report-template" name="modele_rapport_id"><option value="">Rapport libre</option>${selectedTemplateId === "__snapshot__" ? `<option value="__snapshot__" selected>${escapeHtml(item.modele_rapport_nom || "Modèle supprimé")} (contenu conservé)</option>` : ""}${reportTemplates.filter((template) => template.actif).map((template) => `<option value="${template.id}" ${String(template.id) === String(selectedTemplateId) ? "selected" : ""}>${escapeHtml(template.nom)}</option>`).join("")}</select></div>`;
    const adminFields = currentUser.role === "ADMIN" ? `<div class="grid2"><div class="field"><label>Client</label><select id="edit-client" name="client_id">${creationClientOptions(creationClients, item.client_id)}</select></div><div class="field"><label>Technicien assigné</label><select name="technicien_id">${technicianOptions(item.technicien_id)}</select></div></div><div class="field"><label>Équipement concerné</label><select id="edit-equipment" name="equipement_id">${creationEquipmentOptions(item.client_id, item.equipement_id, true)}</select></div>${field("Titre", "titre", "text", true, item.titre)}<div class="field"><label>Description</label><textarea name="description" rows="3">${escapeHtml(item.description || "")}</textarea></div><div class="grid2">${field("Date", "date_intervention", "date", false, String(item.date_intervention || "").slice(0,10))}${field("Heure", "heure", "time", false, String(item.heure || "").slice(0,5))}</div>${templateSelector}` : "";
    const customReportFields = Array.isArray(item.modele_rapport_sections) && item.modele_rapport_sections.length
        ? renderReportFields(item, item.donnees_rapport || {})
        : "";
    modal("Rapport d’intervention", `<form id="edit-intervention-form">
      <p><strong>${escapeHtml(item.titre)}</strong><br><span class="muted">${escapeHtml(item.client_nom)} · ${formatDate(item.date_intervention)}</span></p>
      ${adminFields}
      <div class="field"><label>Statut</label><select name="statut">${["PLANIFIEE","EN_COURS","TERMINEE","ANNULEE"].map((s) => `<option value="${s}" ${s === item.statut ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Compte-rendu</label><textarea name="compte_rendu" rows="5">${escapeHtml(item.compte_rendu || "")}</textarea></div>
      <div id="edit-report-fields">${customReportFields}</div>
      <button class="primary wide">Enregistrer le rapport</button>
    </form><hr><div class="field"><label>Ajouter une photo (5 Mo max.)</label><input id="photo-file" type="file" accept="image/*" capture="environment"><button class="secondary" id="upload-photo">Envoyer la photo</button></div>
    <div class="field"><label>Signature client</label><canvas id="signature-canvas" class="canvas"></canvas><div class="actions"><button class="secondary" id="clear-signature">Effacer</button><button class="primary" id="upload-signature">Enregistrer la signature</button></div></div>
    ${mediaGallery(item)}${pdfButton(item)}`);

    bindReportFieldActions(document.getElementById("edit-intervention-form"));

    document.getElementById("edit-intervention-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = event.currentTarget.querySelector("button[type='submit'], button:not([type])");
        const values = Object.fromEntries(new FormData(event.currentTarget));
        if (values.modele_rapport_id === "__snapshot__") delete values.modele_rapport_id;
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        if (event.currentTarget.querySelector("[data-report-key]")) values.donnees_rapport = collectReportData(event.currentTarget);
        await withBusy(submitButton, async () => {
            try {
                await api(`/interventions/${id}`, { method: "PUT", body: JSON.stringify(values) });
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
    document.getElementById("upload-photo").addEventListener("click", () => uploadPhoto(id));
    setupSignatureCanvas(id);
    bindMediaActions(item);
    bindPdfDownload();
}

async function uploadPhoto(id) {
    const item = interventions.find((entry) => String(entry.id) === String(id));
    const photoSections = (item?.modele_rapport_sections || []).filter((section) => ["photo", "multi_photo", "event_photos"].includes(section.type));
    const photoLimit = photoSections.reduce((total, section) => total + Math.max(1, Number(section.maxPhotos) || (section.type === "photo" ? 1 : 5)), 0);
    if (photoSections.length && (item.photos || []).length >= photoLimit) {
        return toast(`La limite de ${photoLimit} photo(s) définie par le modèle est atteinte.`, true);
    }
    const file = document.getElementById("photo-file").files[0];
    if (!file) return toast("Sélectionnez une photo.", true);
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
function mediaGallery(item) {
    const photos = Array.isArray(item.photos) ? item.photos : [];
    if (!photos.length && !item.signature_url) return `<p class="muted">Aucun média enregistré.</p>`;
    const canDelete = currentUser.role !== "CLIENT";
    return `<div class="field"><label>Photos et signature enregistrées</label><div class="media-grid">${photos.map((photo) => `<div class="media-item"><a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(photo.url)}" alt="Photo de l’intervention"></a>${canDelete ? `<button class="media-delete" data-delete-photo="${photo.id}" aria-label="Supprimer cette photo">🗑</button>` : ""}</div>`).join("")}${item.signature_url ? `<div class="media-item signature"><a href="${escapeHtml(item.signature_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.signature_url)}" alt="Signature du client"></a>${canDelete ? `<button class="media-delete" data-delete-signature="${item.id}" aria-label="Supprimer la signature">🗑</button>` : ""}</div>` : ""}</div></div>`;
}
function bindMediaActions(item) {
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
function pdfButton(item) { return `<p><button class="primary wide" data-download-pdf="${item.id}">Exporter le rapport en PDF</button></p>`; }
function bindPdfDownload() {
    document.querySelectorAll("[data-download-pdf]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        try {
            const response = await fetch(`${API_URL}/interventions/${button.dataset.downloadPdf}/pdf`, { credentials: "include" });
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
function equipmentLabel(item) { return [item.equipement_type, item.equipement_modele, item.equipement_numero_serie].filter(Boolean).join(" · ") || "Non renseigné"; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "Non planifiée"; }
function localDateKey(value) { const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function formatMoney(value, currency = "EUR") { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0)); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function toast(message, bad = false) { document.querySelector(".toast")?.remove(); const node = document.createElement("div"); node.className = `toast ${bad ? "bad" : ""}`; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 3500); }
