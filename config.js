/* Configuración editable de Gradiente.
   Links (data/links.json), mesita (data/kiosco.json) y el resto de los datos están en data/. */
window.GRADIENTE = {
  brand: "Gradiente",
  tagline: "Tu máxima razón de cambio",
  description: "Agrupación estudiantil de Ingeniería UNLP. Defendiendo la universidad pública y la industria nacional.",

  consultationFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeGuH8e9_Yb_C6glZLeWzefB3vMLW1RlIgOFwUTw5RWtrd7hA/viewform?usp=publish-editor",
  driveUrl: "https://drive.google.com/open?id=1nqMOCWnGQf4hijaALpiovu1L5c6PvUJb",
  // carpeta "Parciales" de la nube: destino del buscador cuando una materia no tiene carpeta propia
  nubeParcialesUrl: "https://drive.google.com/drive/folders/1UfDvQ7H14H_3qtnAvem8FTfnhqKWs2aw",
  siuUrl: "https://autogestion.guarani.unlp.edu.ar/acceso",

  // Cuentas (opcionales) con Supabase: login con Google o mail y el plan sincronizado.
  // url y anonKey salen de Supabase → Project Settings → API. La anonKey es pública:
  // lo que protege los datos son las reglas RLS (supabase/migrations/001_cuentas.sql).
  // Con enabled: false la app anda como siempre, todo en el dispositivo.
  auth: {
    // proyecto Supabase "gradiente" (org Gradiente, São Paulo). Prender cuando estén las URLs de Auth configuradas.
    enabled: true,
    url: "https://ccvtjvvtjxllnaakniav.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdnRqdnZ0anhsbG5hYWtuaWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MjQ3ODEsImV4cCI6MjEwNjQwMDc4MX0.P4FbicAmrCIhZ_WOPyh0RygbPA0pYGP0jVNyJ3d20yU"
  },
  // mail de contacto de Gradiente (aparece en #/privacidad para pedir ver o borrar datos)
  contactMail: "gradienteingenieriaunlp@gmail.com",

  // Rutas de datos (todos los JSON viven en data/)
  data: {
    links: "data/links.json",
    kiosco: "data/kiosco.json",
    planes: "data/planes.json",
    nube: "data/nube.json",
    faq: "data/faq.json",
    fechas: "data/fechas.json",
    catedras: "data/catedras.json",
    instagram: "data/instagram.json",
    formulas: "data/formulas.json",
    elementos: "data/elementos.json"
  },

  // Nombre del asistente de preguntas frecuentes del inicio
  botName: "Nabla",

  // Herramientas (Recursos). tablaUrl: si tenemos nuestra propia tabla periódica, poné el link y aparece arriba de la tabla.
  tools: {
    tablaUrl: "",
    // la tabla periódica queda oculta hasta rehacerla; true para volver a mostrarla
    tabla: false,
    pomodoro: { focus: 25, short: 5, long: 15 }
  },

  // Accesos rápidos del inicio: se buscan por título en links.json (o url directa).
  // icon: id, clock, cal, book, cloud, heart, ext · color: navy, red, blue
  quickLinks: [
    { title: "SIU Guaraní", url: "https://autogestion.guarani.unlp.edu.ar/acceso", icon: "id", color: "navy" },
    { title: "Aulas y horarios", match: "Aulas y horarios", icon: "clock", color: "red" },
    { title: "Calendario", match: "Calendario ano lectivo completo", icon: "cal", color: "blue" },
    { title: "Asignaturas", match: "Portal de Asignaturas FI", icon: "book", color: "blue" },
    { title: "Nube de apuntes", match: "Nube de apuntes y parciales", icon: "cloud", color: "navy" },
    { title: "Becas", match: "Becas y pasantias FI", icon: "heart", color: "red" }
  ],

  // "Quiénes somos" (se abre desde el inicio). history: agregar hitos { year, text } y aparece solo.
  about: {
    intro: "Somos una agrupación estudiantil de Ingeniería UNLP. Defendemos la universidad pública y la industria nacional, y laburamos para que cursar sea un poco más fácil.",
    // Foto grupal debajo de la presentación: poné la imagen en assets/ y descomentá.
    // photo: "assets/gradiente-grupo.jpg", photoCaption: "El equipo de Gradiente en la mesita de Electro",
    doing: [
      { title: "Nube de apuntes", text: "Más de 2.600 parciales, finales y apuntes ordenados por materia.", match: "Nube de apuntes y parciales", icon: "cloud" },
      { title: "Mesita en Electro", text: "Kits de cuadernos y útiles a precio estudiante.", go: "#/mesita", icon: "shop" },
      { title: "Mi plan", text: "Tu carrera con correlativas: qué podés cursar y qué finales rendir.", go: "#/plan", icon: "plan" },
      { title: "Consultas", text: "¿No encontrás algo? Preguntanos y te orientamos.", consult: true, icon: "chat" }
    ],
    history: [
      // { year: "2019", text: "Nace Gradiente en ..." },
    ],
    // Página "Quiénes somos" (#/nosotros): foto, texto, foto, texto…
    // photos: imágenes en assets/nosotros/ (con 2 o más se ve un carrusel). Sin fotos se ve un recuadro gris de muestra.
    story: [
      { title: "Somos Gradiente", photoAlt: "Estudiantes de Gradiente en la Facultad", photos: [
        { src: "assets/nosotros/1-apuntes.jpg", alt: "Dos compañeras con apuntes y la tabla periódica de Gradiente" },
        { src: "assets/nosotros/1-mesita-afuera.jpg", alt: "La mesa de apuntes de Gradiente al aire libre" },
        { src: "assets/nosotros/1-mesita-adentro.jpg", alt: "Compañeras atendiendo la mesita de Gradiente" }
      ], text: [
        "Somos estudiantes de Ingeniería que desde el 2019 elegimos organizarnos para transformar nuestra Facultad. Somos estudiantes como vos: cursamos, rendimos, hacemos trabajos prácticos, buscamos apuntes y atravesamos las mismas dificultades que hacen que estudiar una carrera universitaria no siempre sea sencillo.",
        "Por eso, todos los días buscamos construir herramientas para que nadie se quede afuera. Desde los grupos de estudio y el acompañamiento entre compañeros, hasta conseguir materiales a precios accesibles, acercar información, defender nuestros derechos y generar nuevas herramientas que hagan más fácil transitar la carrera. Porque creemos que la permanencia también se construye así: estando presentes y organizándonos para que las dificultades de cada día no se conviertan en motivos para abandonar."
      ] },
      { title: "Construyendo una mejor facultad", photoAlt: "La mesita de Gradiente en Electro", photos: [
        { src: "assets/nosotros/2-miles.jpg", alt: "Gradiente junto a Miles y Latitud" },
        { src: "assets/nosotros/2-escalinata.jpg", alt: "Gradiente en la escalinata con la bandera de Nunca Más" },
        { src: "assets/nosotros/2-mesa-apuntes.jpg", alt: "La mesa de apuntes de Gradiente en la Facultad" }
      ], text: [
        "Creemos que organizarse también es mirar lo que tenemos y preguntarnos cómo podemos mejorarlo. Si una herramienta puede ser más accesible, la hacemos más accesible. Si existe una necesidad, buscamos una respuesta colectiva.",
        "Esta aplicación nace de esa idea: reunir en un solo lugar herramientas que usamos todos los días para cursar, planificar nuestra carrera y saber qué viene después. Es una forma más de aportar soluciones concretas a los problemas que atravesamos como estudiantes."
      ] },
      { title: "Futuros profesionales", photoAlt: "Estudiantes en un laboratorio de la Facultad", photos: [
        { src: "assets/nosotros/3-congreso.jpg", alt: "Gradiente en el Congreso ImpulsAR" },
        { src: "assets/nosotros/3-laboratorio.jpg", alt: "Visita a un laboratorio industrial" },
        { src: "assets/nosotros/3-ctibor.jpg", alt: "Visita a la fábrica de Ctibor" },
        { src: "assets/nosotros/3-marcha.jpg", alt: "Gradiente en la marcha universitaria" }
      ], text: [
        "Pero también creemos que nuestra formación no termina en aprobar materias. Estudiamos Ingeniería en una Universidad Pública porque entendemos que el conocimiento que construimos tiene un rol fundamental en el desarrollo de nuestro país.",
        "Defendemos una Universidad Pública que forme profesionales capaces de aportar a una industria nacional, al desarrollo productivo y a una Argentina soberana, que pueda decidir sobre sus recursos, sus capacidades y su futuro."
      ] },
      { title: "La salida es colectiva", photoAlt: "El equipo de Gradiente", photos: [
        { src: "assets/nosotros/4-noche.jpg", alt: "El equipo de Gradiente de noche" },
        { src: "assets/nosotros/4-mesa-bombo.jpg", alt: "El equipo de Gradiente con la mesa y el bombo" }
      ], text: [
        "Hace años elegimos organizarnos porque sabemos que una Facultad mejor no se construye en soledad. Se construye entre estudiantes, poniendo en común lo que sabemos, acompañándonos cuando cuesta y pensando juntos qué Facultad queremos.",
        "Esta aplicación es una herramienta más de ese camino. Porque creemos que siempre hay algo para transformar, algo para construir y, sobre todo, que siempre lo podemos hacer mejor."
      ] }
    ]
  },

  // Categorías de links.json en Recursos: orden, nombre visible, color, ícono y bajada.
  // "id" es el valor exacto de "category" en links.json. "layout: tiles" = tarjetas con descripción.
  // "hide: true" = no se muestra como bloque (sigue apareciendo en el buscador).
  categories: [
    { id: "Avisos", name: "Avisos", color: "#e11d2a", icon: "bell", hide: true },
    { id: "Ingresantes", name: "Ingresantes", color: "#2563eb", icon: "cap", desc: "Tus primeros pasos en la Facultad." },
    { id: "Consultas frecuentes", name: "Cursada", color: "#7c3aed", icon: "book", desc: "Aulas, horarios, aulas virtuales y trámites de cursada." },
    { id: "Parciales y apuntes", name: "Apuntes", color: "#0ea5e9", icon: "folder", hide: true },
    { id: "Becas y bienestar", name: "Becas y bienestar", color: "#059669", icon: "heart", desc: "Ayudas económicas, pasantías y albergue." },
    { id: "Proyectos e investigacion", name: "Proyectos e investigación", color: "#d97706", icon: "flask", desc: "Sumate a extensión, investigación y laboratorios.", layout: "tiles" },
    { id: "Oportunidades", name: "Oportunidades", color: "#db2777", icon: "spark" },
    { id: "Mapa Facultad", name: "Mapa", color: "#0891b2", icon: "pin", desc: "Ubicate en el predio." },
    { id: "Institucional", name: "Institucional", color: "#475569", icon: "building", desc: "Certificados, servicios y sistemas de la FI." },
    { id: "Contacto", name: "Contacto", color: "#e11d2a", icon: "mail", desc: "Mails oficiales para hacer consultas." }
  ],

  // Asistente del botón "Consultas". Cada tema muestra links de links.json (por título exacto),
  // mails y/o links directos. El tema "materia" abre el buscador de cátedras.
  help: [
    { id: "apuntes", title: "Busco apuntes, parciales o finales", icon: "folder", color: "#0ea5e9", nube: true },
    { id: "materia", title: "Tengo una duda con una materia", sub: "Mail y página de la cátedra", icon: "book", color: "#7c3aed", materia: true },
    { id: "tramites", title: "Trámites, inscripciones y certificados", icon: "doc", color: "#2563eb",
      links: ["Turnos FI para tramites", "Estudiantes FI (tramites, certificados y servicios)", "Prorroga para rendir final", "Calendario ano lectivo completo"],
      mails: [{ label: "Dirección de Enseñanza", mail: "ensenanza@ing.unlp.edu.ar", note: "Inscripciones, finales, equivalencias." }] },
    { id: "becas", title: "Becas y ayuda económica", icon: "heart", color: "#059669",
      links: ["Becas y pasantias FI", "PAE FI (inscripcion y seguimiento de becas)", "Becas UNLP", "Becas Progresar (oficial)", "Fondo de Becas FI (Devolviendo Oportunidades)"],
      mails: [{ label: "Asuntos Estudiantiles", mail: "asuntos.estudiantiles@ing.unlp.edu.ar", note: "Becas, bienestar y situaciones personales." }] },
    { id: "cuenta", title: "SIU, correo o cuentas de la Facultad", icon: "lock", color: "#475569",
      links: ["Como generar tu cuenta SIU-Guarani", "Solicitud de correo institucional para alumnos", "Servicios IT FI", "Portal de Asignaturas FI"] },
    { id: "gradiente", title: "Hablar con Gradiente", sub: "Te respondemos nosotros", icon: "chat", color: "#e11d2a", gradiente: true }
  ],

  socialLinks: [
    { label: "Instagram", icon: "ig", url: "https://instagram.com/gradienteingenieriaunlp" },
    { label: "WhatsApp", icon: "wa", url: "https://chat.whatsapp.com/CRnDHAhup938Nk4uJ8TBVp" },
    { label: "TikTok", icon: "tt", url: "https://www.tiktok.com/@gradiente.ing" },
    { label: "Mail", icon: "mail", url: "mailto:gradienteingenieriaunlp@gmail.com" }
  ]
};
