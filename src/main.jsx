import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {Preferences} from "@capacitor/preferences";
import {LocalNotifications} from "@capacitor/local-notifications";
import {Haptics, ImpactStyle, NotificationType} from "@capacitor/haptics";
import "./styles.css";

const KEY = "freedom-debt-mobile-v1";
const NOTIFY_KEY = "freedom-debt-notifications";
const DAILY_NOTIFY_ID = 9001;
const MILESTONE_IDS = {400000:9100,300000:9101,200000:9102,100000:9103,50000:9104,0:9105};

async function ensureNotificationPermission(){
  try{
    const p=await LocalNotifications.checkPermissions();
    if(p.display !== "granted") await LocalNotifications.requestPermissions();
    return true;
  }catch{return false}
}
async function scheduleDailyReminder(enabled){
  try{
    await LocalNotifications.cancel({notifications:[{id:DAILY_NOTIFY_ID}]});
    if(!enabled) return;
    if(!(await ensureNotificationPermission())) return;
    await LocalNotifications.schedule({notifications:[{
      id:DAILY_NOTIFY_ID, title:"Долг → 0",
      body:"30 секунд, чтобы проверить свой прогресс.",
      schedule:{on:{hour:20,minute:0},allowWhileIdle:true},
      extra:{type:"daily"}
    }]});
  }catch{}
}
async function notifyMilestone(left){
  try{
    const targets=[400000,300000,200000,100000,50000,0];
    const target=targets.find(x=>left<=x);
    if(target===undefined) return;
    const id=MILESTONE_IDS[target];
    if(!(await ensureNotificationPermission())) return;
    const body=target===0 ? "Поздравляем. Ты закрыл все долги." : `Осталось ${rub(target)} или меньше. Продолжай в том же духе.`;
    await LocalNotifications.schedule({notifications:[{id,title:"Долг → 0",body,schedule:{at:new Date(Date.now()+700)},extra:{type:"milestone",target}}]});
  }catch{}
}
const initialDebts = [
  ["Займер","МФО",15000],["СД","МФО",23000],["WebZaim","МФО",8000],
  ["ОКМ","МФО",35000],["ГМ","МФО",18000],["Юкки","МФО",14000],["Webbankir","МФО",7500],
  ["Настя","Люди",70000],["Данич","Люди",75000],["Матвей","Люди",5000],["Ваня","Люди",95000],
  ["Т-Банк","Карты",75500],["Альфа","Карты",10000],["Сбер","Карты",17000]
].map(([name, group, amount], i)=>({id:String(i+1),name,group,amount,paid:0}));

const rub = n => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
async function buzz(style=ImpactStyle.Light){ try{await Haptics.impact({style})}catch{} }
async function success(){try{await Haptics.notification({type:NotificationType.Success})}catch{}}

function App(){
  const [data,setData] = useState({debts:initialDebts, payments:[], streak:0});
  const [tab,setTab] = useState("home");
  const [modal,setModal] = useState(null);
  const [amount,setAmount] = useState("");
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("Все");
  const [loaded,setLoaded] = useState(false);
  const [notifications,setNotifications] = useState({daily:true,milestones:true});

  useEffect(()=>{(async()=>{
    try{
      const r=await Preferences.get({key:KEY});
      if(r.value) setData(JSON.parse(r.value));
      const nr=await Preferences.get({key:NOTIFY_KEY});
      if(nr.value) setNotifications(JSON.parse(nr.value));
    }catch{} finally{setLoaded(true)}
  })()},[]);

  useEffect(()=>{if(loaded) Preferences.set({key:KEY,value:JSON.stringify(data)}).catch(()=>{})},[data,loaded]);
  useEffect(()=>{if(loaded) { Preferences.set({key:NOTIFY_KEY,value:JSON.stringify(notifications)}).catch(()=>{}); scheduleDailyReminder(notifications.daily); }},[notifications.daily,loaded]);

  const total = useMemo(()=>data.debts.reduce((s,d)=>s+d.amount,0),[data.debts]);
  const paid = useMemo(()=>data.debts.reduce((s,d)=>s+d.paid,0),[data.debts]);
  const left = total-paid;
  const pct = total ? Math.min(100, paid/total*100) : 100;
  const filtered = data.debts.filter(d=>
    (filter==="Все" || d.group===filter) &&
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const openPayment = (debt=null)=>{
    setAmount("");
    setModal(debt ? {type:"payment",debtId:debt.id} : {type:"chooseDebt"});
    buzz();
  };

  const savePayment = async ()=>{
    const n=Number(String(amount).replace(/\s/g,"").replace(",",".")); 
    const d=data.debts.find(x=>x.id===modal.debtId);
    if(!d || !Number.isFinite(n) || n<=0) return;
    const max=d.amount-d.paid, actual=Math.min(n,max);
    const newLeft=left-actual;
    setData(x=>({
      ...x,
      debts:x.debts.map(v=>v.id===d.id?{...v,paid:v.paid+actual}:v),
      payments:[{id:uid(),debtId:d.id,debtName:d.name,amount:actual,date:new Date().toISOString()},...x.payments]
    }));
    setModal({type:"success",amount:actual,debt:d.name});
    if(notifications.milestones) await notifyMilestone(newLeft);
    await success();
  };

  const reset = async()=>{
    setData({debts:initialDebts.map(x=>({...x})),payments:[],streak:0});
    setModal(null); await buzz(ImpactStyle.Medium);
  };

  if(!loaded) return <div className="boot"><div className="mark">0</div><span>Загрузка</span></div>;

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-dot"/>Долг → 0</div>
      <button className="icon-btn" onClick={()=>setModal({type:"settings"})} aria-label="Настройки">⋯</button>
    </header>

    <main className="content">
      {tab==="home" && <Home left={left} paid={paid} total={total} pct={pct} streak={data.streak} debtCount={data.debts.length} openPayment={openPayment} setTab={setTab}/>}
      {tab==="debts" && <Debts debts={filtered} total={total} paid={paid} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} openPayment={openPayment}/>}
      {tab==="history" && <History payments={data.payments}/>}
    </main>

    <nav className="nav">
      {[["home","Главная","⌂"],["debts","Долги","▤"],["history","История","↺"]].map(([id,label,icon])=>
        <button key={id} className={tab===id?"nav-item active":"nav-item"} onClick={()=>{setTab(id);buzz()}}>
          <span>{icon}</span><small>{label}</small>
        </button>
      )}
    </nav>

    {modal?.type==="chooseDebt" && <ChooseDebtModal debts={data.debts} close={()=>setModal(null)} choose={d=>{setAmount("");setModal({type:"payment",debtId:d.id});buzz()}}/>}
    {modal?.type==="payment" && <PaymentModal debt={data.debts.find(d=>d.id===modal.debtId)} amount={amount} setAmount={setAmount} close={()=>setModal(null)} save={savePayment}/>}
    {modal?.type==="success" && <SuccessModal {...modal} close={()=>setModal(null)} goHistory={()=>{setModal(null);setTab("history")}}/>}
    {modal?.type==="settings" && <SettingsModal close={()=>setModal(null)} data={data} reset={reset} notifications={notifications} setNotifications={setNotifications}/>}
  </div>
}

function Home({left,paid,total,pct,streak,debtCount,openPayment,setTab}){
  return <section className="screen home">
    <div className="hero">
      <div className="eyebrow">ОСТАЛОСЬ ПО ДОЛГАМ</div>
      <div className="big-number">{rub(left)}</div>
      <div className="progress"><div style={{width:`${pct}%`}}/></div>
      <div className="progress-meta"><span>Погашено {rub(paid)}</span><b>{Math.round(pct)}%</b></div>
    </div>

    <div className="payment-card">
      <div><div className="eyebrow">ДВИЖЕНИЕ К НУЛЮ</div><h2>Любой платёж — шаг вперёд</h2><p>Выбери нужный долг после нажатия кнопки.</p></div>
      <button className="primary" onClick={()=>openPayment()}>Внести платёж</button>
    </div>

    <div className="quick-grid">
      <button onClick={()=>setTab("debts")}><strong>{debtCount}</strong><span>долгов</span></button>
      <button onClick={()=>setTab("history")}><strong>{rub(paid)}</strong><span>уже погашено</span></button>
      <button><strong>{streak}</strong><span>дней без игры</span></button>
    </div>

    <div className="quote">Не нужно решить всё сегодня.<br/><b>Нужно просто уменьшить цифру.</b></div>
  </section>
}

function Debts({debts,total,paid,search,setSearch,filter,setFilter,openPayment}){
  return <section className="screen">
    <div className="section-head"><div><div className="eyebrow">ОБЯЗАТЕЛЬСТВА</div><h1>Мои долги</h1></div><span className="counter">{debts.length}</span></div>
    <div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Найти долг"/></div>
    <div className="pills">{["Все","МФО","Карты","Люди"].map(x=><button key={x} className={filter===x?"pill active":"pill"} onClick={()=>{setFilter(x);buzz()}}>{x}</button>)}</div>
    <div className="debt-list">{debts.map(d=>{
      const remain=d.amount-d.paid, done=remain<=0;
      return <button className="debt-row" key={d.id} onClick={()=>!done&&openPayment(d)}>
        <span className="debt-main"><b>{d.name}</b><small>{d.group}</small></span>
        <span className="debt-right"><b className={done?"done":""}>{done?"Погашен":rub(remain)}</b><span>{done?"✓":"→"}</span></span>
      </button>
    })}</div>
  </section>
}

function History({payments}){
  return <section className="screen">
    <div className="eyebrow">ДВИЖЕНИЕ</div><h1>История</h1>
    {!payments.length ? <div className="empty"><span>—</span><h2>Пока пусто</h2><p>Первый платёж появится здесь.</p></div> :
      <div className="history">{payments.map(p=><div className="history-row" key={p.id}><span className="history-icon">−</span><div><b>{p.debtName}</b><small>{new Date(p.date).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</small></div><strong>− {rub(p.amount)}</strong></div>)}</div>}
  </section>
}

function ChooseDebtModal({debts,close,choose}){
  const groups=["МФО","Карты","Люди"];
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="sheet debt-picker">
    <div className="sheet-handle"/><div className="sheet-head"><div><div className="eyebrow">ПЛАТЁЖ</div><h2>Куда внести?</h2><p>Выбери долг, который сейчас оплачиваешь.</p></div><button className="close" onClick={close}>×</button></div>
    {groups.map(g=><div key={g} className="picker-group"><div className="picker-title">{g}</div>{debts.filter(d=>d.group===g && d.amount>d.paid).map(d=><button className="picker-row" key={d.id} onClick={()=>choose(d)}><span><b>{d.name}</b><small>{rub(d.amount-d.paid)} осталось</small></span><span>→</span></button>)}</div>)}
  </div></div>
}

function PaymentModal({debt,amount,setAmount,close,save}){
  const append=(v)=>setAmount(x=>x.length>8?x:x+v);
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}>
    <div className="sheet">
      <div className="sheet-handle"/>
      <div className="sheet-head"><div><div className="eyebrow">ПЛАТЁЖ</div><h2>{debt.name}</h2><p>Осталось {rub(debt.amount-debt.paid)}</p></div><button className="close" onClick={close}>×</button></div>
      <div className="amount-input">{amount||"0"}<span>₽</span></div>
      <div className="keypad">{["1","2","3","4","5","6","7","8","9","←","0","000"].map(k=><button key={k} onClick={()=>k==="←"?setAmount(x=>x.slice(0,-1)):append(k)}>{k}</button>)}</div>
      <button className="primary full" disabled={!Number(amount)} onClick={save}>Внести платёж</button>
    </div>
  </div>
}
function SuccessModal({amount,debt,close,goHistory}){
  return <div className="overlay"><div className="success-sheet"><div className="success-mark">✓</div><div className="eyebrow">ПЛАТЁЖ СОХРАНЁН</div><div className="success-amount">− {rub(amount)}</div><p>{debt}</p><button className="primary full" onClick={close}>Продолжить</button><button className="text-btn" onClick={goHistory}>Открыть историю</button></div></div>
}
function SettingsModal({close,data,reset,notifications,setNotifications}){
  const exportData=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dolg-0-backup.json";a.click();URL.revokeObjectURL(a.href);
  };
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="sheet settings">
    <div className="sheet-handle"/><div className="sheet-head"><div><div className="eyebrow">ПРИЛОЖЕНИЕ</div><h2>Настройки</h2></div><button className="close" onClick={close}>×</button></div>
    <div className="settings-title">Уведомления</div>
    <div className="setting-row"><div><b>Вечернее напоминание</b><small>Каждый день в 20:00</small></div><button className={notifications.daily?"toggle on":"toggle"} onClick={()=>setNotifications(x=>({...x,daily:!x.daily}))}>{notifications.daily?"Вкл":"Выкл"}</button></div>
    <div className="setting-row"><div><b>Рубежи долга</b><small>400 / 300 / 200 / 100 / 50 тыс. и 0 ₽</small></div><button className={notifications.milestones?"toggle on":"toggle"} onClick={()=>setNotifications(x=>({...x,milestones:!x.milestones}))}>{notifications.milestones?"Вкл":"Выкл"}</button></div>
    <div className="setting-row"><div><b>Резервная копия</b><small>Скачать данные долгов и платежей</small></div><button onClick={exportData}>Экспорт</button></div>
    <div className="setting-row danger"><div><b>Сбросить прогресс</b><small>Вернуть исходные 468 000 ₽</small></div><button onClick={reset}>Сброс</button></div>
    <p className="version">Долг → 0 · версия 1.1</p>
  </div></div>
}

createRoot(document.getElementById("root")).render(<App/>);
