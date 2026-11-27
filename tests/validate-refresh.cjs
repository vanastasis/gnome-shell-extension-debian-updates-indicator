const fs = require('node:fs');
const path = require('node:path');

function runRefreshTests(source) {
    const assert=(v,msg)=>{if(!v)throw Error(msg);};
    const SCRIPT={UPGRADES:0,NEW:1,OBSOLETE:2,RESIDUAL:3,AUTOREMOVABLE:4}, STATUS={ERROR:-2};
    let next=1, timers=new Map(), procs=[], programs=new Set(['pkcon']), spawnError=false;
    const GLib={PRIORITY_DEFAULT:0,SOURCE_REMOVE:false,find_program_in_path:n=>programs.has(n)?'/usr/bin/'+n:null,
        path_get_basename:p=>p.split('/').pop(),timeout_add_seconds:(p,d,cb)=>{assert(Number.isInteger(d)&&d>0,'timer delay');const id=next++;timers.set(id,{d,cb});return id;},
        source_remove:id=>timers.delete(id),shell_parse_argv:v=>[true,v.split(/\s+/)]};
    const Gio={SubprocessFlags:{STDOUT_PIPE:1,STDERR_PIPE:2},Subprocess:{new:argv=>{
        if(spawnError){spawnError=false;throw Error('spawn failure');}
        const p={argv,done:false,killed:false,communicate_utf8_async(a,b,cb){this.cb=cb;},
            communicate_utf8_finish(){return [true,this.out,this.err];},get_successful(){return this.success;},force_exit(){this.killed=true;},
            complete(ok=true,out='',err=''){this.success=ok;this.out=out;this.err=err;this.done=true;this.cb(this,{});}};
        procs.push(p);return p;}}};
    const errors=[], Main={notifyError:(n,m)=>errors.push(m)};
    const Manager=new Function('GLib','Gio','Main','Indicator','_','formatDateWithCFormatString','console',
        source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')+'\nreturn UpdateManager;')
        (GLib,Gio,Main,{SCRIPT,STATUS},x=>x,()=> 'test date',{warn(){}});
    const fresh=()=>{
        next=1;timers.clear();procs=[];errors.length=0;programs=new Set(['pkcon']);spawnError=false;
        const a=Object.create(Manager.prototype), s={'use-custom-cmd':false,'check-cmd-custom':'','check-interval':1,'interval-unit':0,
            'last-check-date-automatic-double':0,'last-check-date-double':0,'show-critical-updates':true,'new-packages':false,'obsolete-packages':false};
        const menu=()=>({setSensitive(v){this.sensitive=v;},label:{set_text(v){this.text=v;}}});
        const i={_updateList:[],_urgentList:[],applyUpdatesMenuItem:menu(),removeUnusedMenuItem:menu(),checkNowMenuItem:menu(),lastCheckMenuItem:menu(),
            showChecking(v){this.checking=v;},updateStatus(v){this.status=v;},_updateCleanupSensitivity(){},updatePackagesStatus(n){if(n===0)this.status=this._updateList.length;}};
        Object.assign(a,{_destroyed:false,_networkPending:false,_refreshScanPending:false,_refreshTimeoutId:0,_scanProcesses:new Map(),_scanTimeouts:new Map(),
            _refreshProcess:null,_cleanupProcess:null,_initializing:false,_initTimeoutId:null,_extensionPath:'/extension',_cachePath:'/cache',_extensionName:'test',
            _indicator:i,_cancellable:{},_dirMonitor:{start(){},stop(){}},_extensionSettings:{get_boolean:k=>s[k],get_string:k=>s[k],get_int:k=>s[k],get_double:k=>s[k],set_double:(k,v)=>s[k]=v,get_strv:()=>[]}});
        return {a,s,i};
    };
    const fire=id=>{const t=timers.get(id);assert(t,'missing timer');timers.delete(id);t.cb();};
    const scan=name=>procs.find(p=>p.argv[1]?.endsWith('/'+name+'.sh')&&!p.done&&!p.killed);
    const cmd=()=>{assert(procs.length,'no command: '+errors.join('; '));return procs[0].argv.join(' ');};
    let {a,s,i}=fresh();a._checkNetwork(false);assert(cmd()==='/usr/bin/pkcon --plain refresh force','pkcon');
    procs[0].complete();assert(a._operationBusy()&&i.checking,'lock');scan('get-updates').complete(true,'foo\t1.2\n');
    assert(!a._operationBusy()&&!i.checking&&i.status===1,'primary scan releases spinner');
    assert(s['last-check-date-double']>0&&!s['last-check-date-automatic-double'],'manual timestamp');
    const urgent=scan('urgency');assert(urgent,'urgency starts');fire(a._scanTimeouts.get(5));assert(urgent.killed&&!i.checking&&i.status===1,'urgency timeout');
    ({a,s,i}=fresh());programs=new Set(['pkgcli']);a._checkNetwork(false);assert(cmd()==='/usr/bin/pkgcli refresh','pkgcli');
    procs[0].complete();scan('get-updates').complete(true,'');assert(i.status===0&&!i.checking,'empty result');
    ({a,s,i}=fresh());s['use-custom-cmd']=true;s['check-cmd-custom']='pkexec apt update';a._checkNetwork(true);
    assert(cmd()==='pkexec apt update','custom command');procs[0].complete();scan('get-updates').complete(true,'');
    assert(s['last-check-date-automatic-double']>0&&timers.get(a._initTimeoutId).d===3600,'auto timestamp and hours');
    for(const custom of ['pkgcli update',' ']){({a,s,i}=fresh());s['use-custom-cmd']=true;s['check-cmd-custom']=custom;a._checkNetwork(false);assert(!procs.length&&!i.checking&&errors.length===1,'invalid custom');}
    ({a,s,i}=fresh());programs.clear();a._checkNetwork(false);assert(!procs.length&&errors.length===1&&!i.checking,'missing dependency');
    ({a,s,i}=fresh());a._checkNetwork(true);procs[0].complete(false,'','network error');
    assert(!a._operationBusy()&&!i.checking&&!s['last-check-date-double']&&timers.get(a._initTimeoutId).d===300,'failed auto retry');
    ({a,s,i}=fresh());a._checkNetwork(false);const old=procs[0];fire(a._refreshTimeoutId);
    assert(old.killed&&!a._operationBusy()&&!i.checking&&!s['last-check-date-double'],'refresh timeout');old.complete();assert(!scan('get-updates'),'late completion ignored');
    ({a,s,i}=fresh());a._checkNetwork(false);procs[0].complete();fire(a._scanTimeouts.get(0));assert(!i.checking&&!a._operationBusy()&&!s['last-check-date-double'],'scan timeout');
    ({a,s,i}=fresh());a._checkNetwork(false);procs[0].complete();scan('get-updates').complete(false,'','apt error');assert(!i.checking&&!s['last-check-date-double'],'scan error');
    ({a,s,i}=fresh());spawnError=true;a._checkNetwork(false);assert(!a._operationBusy()&&!i.checking&&errors.length===1,'spawn failure');
    ({a,s,i}=fresh());s['check-interval']=0;a._initializeInterval();assert(!a._initTimeoutId,'disabled timer');a._checkNetwork(false);assert(procs.length===1,'manual still works');
    ({a,s,i}=fresh());s['check-interval']=2;s['interval-unit']=1;assert(a._intervalSeconds()===172800,'days');s['interval-unit']=2;assert(a._intervalSeconds()===1209600,'weeks');
    a._scheduleAutomatic(1);a._cleanupProcess={};fire(a._initTimeoutId);assert(timers.get(a._initTimeoutId).d===30&&!procs.length,'busy deferral');a._cleanupProcess=null;fire(a._initTimeoutId);assert(procs.length===1,'deferred real check');
    ({a,s,i}=fresh());a._checkNetwork(false);a._checkNetwork(false);assert(procs.length===1,'duplicate check');a._destroyed=true;procs[0].complete();assert(!scan('get-updates'),'disabled callback');
    return 'Refresh regression tests passed: command selection, settings, scheduling, timeout, errors, lock and stale callbacks.';
}

console.log(runRefreshTests(fs.readFileSync(path.join(process.argv[2], 'updateManager.js'), 'utf8')));
