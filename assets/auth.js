/* Gradiente · cuentas (opcionales) con Supabase.
   Expone window.GAuth. Si config.js → auth.enabled es false, o Supabase no carga
   (sin red), la app sigue andando igual que siempre, todo en este dispositivo.
   El router usa el hash (#/plan), por eso el login vuelve con ?code= (flujo PKCE):
   acá se canjea el código y se limpia la URL antes de que arranque la app. */
(function () {
  "use strict";
  var CFG = (window.GRADIENTE || {}).auth || {};
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  var sb = null, user = null, listeners = [], recovery = false, role = "estudiante", roleFor = null;

  var G = window.GAuth = {
    enabled: !!(CFG.enabled && CFG.url && CFG.anonKey),
    ready: null,
    user: function () { return user; },
    provider: function () { return user && user.app_metadata ? user.app_metadata.provider : null; },
    // estudiante (lo normal), organizador o admin. Lo decide la base (user_roles), no la app.
    role: function () { return user ? role : "estudiante"; },
    loadRole: loadRole,
    listStaff: listStaff,
    setRole: setRole,
    // avisos de Notificaciones: cualquiera los lee (aunque las cuentas estén apagadas); el equipo los escribe
    avisos: avisos,
    saveAviso: saveAviso,
    deleteAviso: deleteAviso,
    uploadAvisoImage: uploadAvisoImage,
    removeAvisoImage: removeAvisoImage,
    // mesita: cualquiera la lee; el equipo agrega, edita y saca
    kiosco: kiosco,
    saveKiosco: saveKiosco,
    deleteKiosco: deleteKiosco,
    // links, preguntas frecuentes y cátedras: lectura pública y edición del equipo
    rows: rows,
    saveRow: saveRow,
    deleteRow: deleteRow,
    // funciones de la base para el equipo (qué se cursa)
    rpc: function (fn, args) { return need().then(function () { return sb.rpc(fn, args || {}); }).then(unwrap); },
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
        if (!user || user.id !== roleFor) role = "estudiante";
        if (ev === "PASSWORD_RECOVERY") recovery = true;
        // los avisos van después de la carga inicial (getSession), en la próxima vuelta
        setTimeout(function () { emit(ev); }, 0);
      });
      return sb.auth.getSession();
    }).then(function (r) {
      user = r && r.data && r.data.session ? r.data.session.user : null;
      cleanUrl();
      return loadRole().then(function () { return user; });
    }),
    // si la red está lenta, la app arranca igual y el login se suma cuando llegue
    new Promise(function (ok) { setTimeout(function () { ok(null); }, 4000); })
  ]).catch(function (e) {
    console.warn("[cuentas] sin conexión con Supabase:", e && e.message);
    G.enabled = false; cleanUrl();
    return null;
  });

  /* ---------- roles: los da un admin con set_user_role; acá solo se leen ---------- */
  function loadRole() {
    if (!user || !sb) { role = "estudiante"; roleFor = null; return Promise.resolve(role); }
    var id = user.id;
    return sb.rpc("my_role").then(unwrap).then(function (r) {
      if (user && user.id === id) { role = r || "estudiante"; roleFor = id; }
      return role;
    }).catch(function () { return role; });
  }
  function listStaff() { return need().then(function () { return sb.rpc("list_staff"); }).then(unwrap); }
  function setRole(mail, r) {
    return need().then(function () { return sb.rpc("set_user_role", { target_email: mail, new_role: r }); }).then(unwrap).then(function () {
      return user && String(user.email).toLowerCase() === String(mail).trim().toLowerCase() ? loadRole() : null;
    });
  }

  /* ---------- avisos ---------- */
  var AV_COLS = "id,kind,title,body,url,image,starts_on,ends_on,pinned,in_cal,created_at,updated_at";
  // con sesión del equipo se ven también los programados y los vencidos; si no, una lectura pública (sin la librería)
  function avisos() {
    if (sb && user && role !== "estudiante") {
      return sb.from("avisos").select(AV_COLS).order("pinned", { ascending: false }).order("starts_on", { ascending: false }).limit(60).then(unwrap);
    }
    if (!CFG.url || !CFG.anonKey) return Promise.resolve([]);
    return fetch(CFG.url + "/rest/v1/avisos?select=" + AV_COLS + "&order=pinned.desc,starts_on.desc&limit=30", {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (r) { if (!r.ok) throw new Error("avisos " + r.status); return r.json(); });
  }
  function saveAviso(a) {
    var row = { kind: a.kind, title: a.title, body: a.body || null, url: a.url || null, image: a.image || null, starts_on: a.starts_on, ends_on: a.ends_on || null, pinned: !!a.pinned, in_cal: a.in_cal !== false };
    return need().then(function () {
      var q = a.id ? sb.from("avisos").update(row).eq("id", a.id) : sb.from("avisos").insert(row);
      return q.select(AV_COLS).single();
    }).then(unwrap);
  }
  // también borra su foto si es de las que subimos nosotros
  function deleteAviso(a) {
    return need().then(function () { return sb.from("avisos").delete().eq("id", a.id); }).then(unwrap).then(function () { return removeAvisoImage(a.image); });
  }
  function removeAvisoImage(url) {
    var m = String(url || "").match(/\/storage\/v1\/object\/public\/avisos\/(.+)$/);
    if (!m || !sb) return Promise.resolve();
    return sb.storage.from("avisos").remove([decodeURIComponent(m[1])]).catch(function () {});
  }
  // la foto llega ya achicada (jpeg); se guarda con un nombre al azar y se usa su link público
  function uploadAvisoImage(blob) {
    var path = new Date().toISOString().slice(0, 7) + "/" + Math.random().toString(36).slice(2) + Date.now().toString(36) + ".jpg";
    return need().then(function () { return sb.storage.from("avisos").upload(path, blob, { contentType: "image/jpeg", upsert: false }); }).then(unwrap)
      .then(function () { return sb.storage.from("avisos").getPublicUrl(path).data.publicUrl; });
  }

  /* ---------- mesita ---------- */
  var KI_COLS = "id,kind,name,price,category,description,items,label,image,in_stock,active,priority,updated_at";
  function kiosco() {
    if (sb && user && role !== "estudiante") return sb.from("kiosco").select(KI_COLS).order("priority").then(unwrap);
    if (!CFG.url || !CFG.anonKey) return Promise.reject(new Error("sin Supabase"));
    return fetch(CFG.url + "/rest/v1/kiosco?select=" + KI_COLS + "&order=priority", {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (r) { if (!r.ok) throw new Error("kiosco " + r.status); return r.json(); });
  }
  function saveKiosco(k) {
    var row = { kind: k.kind, name: k.name, price: k.price, category: k.category || null, description: k.description || null, items: k.items || [], label: k.label || null,
      image: k.image || null, in_stock: k.in_stock !== false, active: k.active !== false, priority: k.priority == null ? 50 : k.priority };
    return need().then(function () {
      var q = k.id ? sb.from("kiosco").update(row).eq("id", k.id) : sb.from("kiosco").insert(row);
      return q.select(KI_COLS).single();
    }).then(unwrap);
  }
  function deleteKiosco(k) {
    return need().then(function () { return sb.from("kiosco").delete().eq("id", k.id); }).then(unwrap).then(function () { return removeAvisoImage(k.image); });
  }

  /* ---------- tablas que edita el equipo (links, faq, catedras) ---------- */
  // con sesión del equipo, por la librería (ve también lo oculto); si no, lectura pública sin librería
  // order: "columna" o "columna.desc"; limit opcional
  function rows(table, cols, order, limit) {
    var o = String(order || "priority").split("."), desc = o[1] === "desc";
    if (sb && user && role !== "estudiante") { var q = sb.from(table).select(cols).order(o[0], { ascending: !desc }); if (limit) q = q.limit(limit); return q.then(unwrap); }
    if (!CFG.url || !CFG.anonKey) return Promise.reject(new Error("sin Supabase"));
    return fetch(CFG.url + "/rest/v1/" + table + "?select=" + cols + "&order=" + (order || "priority") + (limit ? "&limit=" + limit : ""), {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (r) { if (!r.ok) throw new Error(table + " " + r.status); return r.json(); });
  }
  // key: columna que identifica la fila; isNew: insertar en vez de actualizar
  function saveRow(table, key, row, isNew, cols) {
    return need().then(function () {
      var q = isNew ? sb.from(table).insert(row) : sb.from(table).update(row).eq(key, row[key]);
      return q.select(cols || "*").single();
    }).then(unwrap);
  }
  function deleteRow(table, key, val) { return need().then(function () { return sb.from(table).delete().eq(key, val); }).then(unwrap); }

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
      [/signups not allowed|signup.*disabled/i, "Por ahora no se pueden crear cuentas nuevas."],
      [/no hay cuenta con ese mail/i, "No hay ninguna cuenta con ese mail. Tiene que entrar una vez a la página primero."],
      [/único admin/i, "Sos el único admin: antes de sacarte el rol, nombrá a otra persona."],
      [/solo admins/i, "Eso lo puede hacer solo un admin."],
      [/row-level security|violates row-level|permission denied/i, "No tenés permiso para hacer eso."],
      [/avisos_fechas/i, "La fecha de fin tiene que ser después de la de inicio."],
      [/payload too large|exceeded the maximum/i, "La foto es muy pesada. Probá con otra."]
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(m)) return map[i][1];
    return "Algo salió mal. Probá de nuevo.";
  }
})();
