/* Gradiente · cuentas (opcionales) con Supabase.
   Expone window.GAuth. Si config.js → auth.enabled es false, o Supabase no carga
   (sin red), la app sigue andando igual que siempre, todo en este dispositivo.
   El router usa el hash (#/plan), por eso el login vuelve con ?code= (flujo PKCE):
   acá se canjea el código y se limpia la URL antes de que arranque la app. */
(function () {
  "use strict";
  var CFG = (window.GRADIENTE || {}).auth || {};
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  var sb = null, user = null, listeners = [], recovery = false;

  var G = window.GAuth = {
    enabled: !!(CFG.enabled && CFG.url && CFG.anonKey),
    ready: null,
    user: function () { return user; },
    provider: function () { return user && user.app_metadata ? user.app_metadata.provider : null; },
    inRecovery: function () { return recovery; },
    onChange: function (fn) { listeners.push(fn); },
    signInGoogle: signInGoogle,
    signInPassword: signInPassword,
    signUp: signUp,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    signOut: signOut,
    deleteAccount: deleteAccount,
    push: push,
    pull: pull,
    errorText: errorText
  };

  function emit(ev) { listeners.forEach(function (fn) { try { fn(ev, user); } catch (e) { console.error(e); } }); }
  function home() { return location.origin + "/"; }
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = LIB; s.async = true; s.crossOrigin = "anonymous";
      s.onload = ok; s.onerror = function () { fail(new Error("no cargó supabase-js")); };
      document.head.appendChild(s);
    });
  }
  // saca ?code=, ?error=… de la URL y deja solo el hash de la app
  function cleanUrl() {
    if (!/[?&](code|error|error_code|error_description)=/.test(location.search)) return;
    var hash = location.hash && location.hash !== "#" ? location.hash : "#/";
    history.replaceState(null, "", location.pathname + hash);
  }

  G.ready = !G.enabled ? Promise.resolve(null) : Promise.race([
    loadLib().then(function () {
      sb = window.supabase.createClient(CFG.url, CFG.anonKey, {
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: "gradiente.auth" }
      });
      sb.auth.onAuthStateChange(function (ev, session) {
        user = session ? session.user : null;
        if (ev === "PASSWORD_RECOVERY") recovery = true;
        // los avisos van después de la carga inicial (getSession), en la próxima vuelta
        setTimeout(function () { emit(ev); }, 0);
      });
      return sb.auth.getSession();
    }).then(function (r) {
      user = r && r.data && r.data.session ? r.data.session.user : null;
      cleanUrl();
      return user;
    }),
    // si la red está lenta, la app arranca igual y el login se suma cuando llegue
    new Promise(function (ok) { setTimeout(function () { ok(null); }, 4000); })
  ]).catch(function (e) {
    console.warn("[cuentas] sin conexión con Supabase:", e && e.message);
    G.enabled = false; cleanUrl();
    return null;
  });

  function need() { return sb ? Promise.resolve(sb) : Promise.reject(new Error("Las cuentas no están disponibles ahora.")); }
  function unwrap(r) { if (r.error) throw r.error; return r.data; }

  function signInGoogle() {
    return need().then(function () { return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: home() } }); }).then(unwrap);
  }
  function signInPassword(mail, pass) {
    return need().then(function () { return sb.auth.signInWithPassword({ email: mail, password: pass }); }).then(unwrap);
  }
  function signUp(mail, pass, name) {
    return need().then(function () {
      return sb.auth.signUp({ email: mail, password: pass, options: { emailRedirectTo: home(), data: name ? { full_name: name } : {} } });
    }).then(unwrap);
  }
  function resetPassword(mail) {
    return need().then(function () { return sb.auth.resetPasswordForEmail(mail, { redirectTo: home() }); }).then(unwrap);
  }
  function updatePassword(pass) {
    return need().then(function () { return sb.auth.updateUser({ password: pass }); }).then(unwrap).then(function (d) { recovery = false; return d; });
  }
  function signOut() {
    return need().then(function () { return sb.auth.signOut({ scope: "local" }); }).then(function () { user = null; });
  }
  function deleteAccount() {
    return need().then(function () { return sb.rpc("delete_my_account"); }).then(unwrap).then(function () { return sb.auth.signOut({ scope: "local" }); }).then(function () { user = null; });
  }

  /* ---------- datos: una fila de perfil y una de plan por persona ---------- */
  function push(data) {
    if (!user) return Promise.resolve(null);
    var now = new Date().toISOString(), id = user.id, jobs = [];
    if (data.profile) jobs.push(sb.from("profiles").upsert(Object.assign({}, data.profile, { id: id, updated_at: now })).then(unwrap));
    if (data.plan) jobs.push(sb.from("plan_state").upsert(Object.assign({}, data.plan, { user_id: id, updated_at: now })).then(unwrap));
    return Promise.all(jobs).then(function () { return now; });
  }
  function pull() {
    if (!user) return Promise.resolve(null);
    var id = user.id;
    return Promise.all([
      sb.from("profiles").select("name, photo, legajo, dni, mail, palette, updated_at").eq("id", id).maybeSingle().then(unwrap),
      sb.from("plan_state").select("career, prog, xo, afc, tv, rv, sh, updated_at").eq("user_id", id).maybeSingle().then(unwrap)
    ]).then(function (r) { return { profile: r[0], plan: r[1] }; });
  }

  /* errores de Supabase en castellano */
  function errorText(e) {
    var m = String((e && (e.message || e.error_description)) || e || "");
    var map = [
      [/invalid login credentials/i, "El mail o la contraseña no coinciden."],
      [/email not confirmed/i, "Todavía no confirmaste tu mail. Fijate en tu casilla (y en spam)."],
      [/user already registered|already been registered/i, "Ya hay una cuenta con ese mail. Probá entrar."],
      [/password should be at least|password.*(short|length)/i, "La contraseña tiene que tener al menos 8 caracteres."],
      [/weak password|pwned/i, "Esa contraseña es muy fácil de adivinar. Probá con otra."],
      [/unable to validate email|invalid email|email address.*invalid/i, "Ese mail no parece válido."],
      [/rate limit|too many requests|security purposes/i, "Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo."],
      [/same.*password|new password should be different/i, "La contraseña nueva tiene que ser distinta de la anterior."],
      [/network|fetch|failed to load|no cargó/i, "No hay conexión. Probá de nuevo en un rato."],
      [/signups not allowed|signup.*disabled/i, "Por ahora no se pueden crear cuentas nuevas."]
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(m)) return map[i][1];
    return "Algo salió mal. Probá de nuevo.";
  }
})();
