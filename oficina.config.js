// ============================================================
//  OFICINA VIRTUAL 3D · TU CONFIGURACIÓN
//  Cambia aquí el nombre, los departamentos, los colores y los agentes.
//  Todo lo de este archivo son DATOS DE EJEMPLO (empresa ficticia).
// ============================================================
window.OFICINA = {
  // Nombre que flota sobre el núcleo central y sale en la cabecera
  empresa: 'Mi Empresa',
  lema: 'Oficina virtual 3D',
  colorCentral: '#7c5ce6',

  // Recepción, en el centro (pon `recepcion: false` para quitarla)
  recepcion: {
    nombre: 'Recepción',
    tareas: ['Lee un mensaje nuevo y decide a quién pasarlo', 'Busca en internet: horario de un proveedor', 'Escribe la respuesta de bienvenida'],
  },

  // Cada departamento es un edificio (máximo 5). Cada agente tiene su propia oficina dentro.
  // `oficina` decide cómo se amuebla su puesto. Tipos: ventas, captacion, atencion, contenido, investigacion,
  // desarrollo, entrega, finanzas, direccion, pizarra, servidores, seguridad, laboratorio, comunidad, academia,
  // analitica, formacion.
  // `estado` (opcional): 'funciona' (por defecto), 'a_medias' o 'no_existe' (sale en obras y sin agente).
  // Las tareas que empiezan por «Busca en internet» o «Lee» cambian el holograma que flota sobre el agente.
  departamentos: [
    {
      id: 'ventas',
      nombre: 'Ventas',
      color: '#3f7be0',
      responsable: { nombre: 'Responsable de ventas', tareas: ['Reparte los contactos del día', 'Revisa las propuestas del equipo', 'Mira el embudo de la semana'] },
      agentes: [
        { id: 'ventas-1', nombre: 'Agente de ventas', puesto: 'Propuestas', oficina: 'ventas',
          tareas: ['Lee la ficha de un contacto nuevo', 'Escribe una propuesta a medida', 'Busca en internet: precios de la competencia'] },
        { id: 'ventas-2', nombre: 'Agente de captación', puesto: 'Captación', oficina: 'captacion',
          tareas: ['Busca en internet: negocios de la zona', 'Escribe el primer mensaje', 'Lee las respuestas de ayer'] },
      ],
    },
    {
      id: 'atencion',
      nombre: 'Atención al cliente',
      color: '#2f9e6a',
      responsable: { nombre: 'Responsable de atención', tareas: ['Revisa las conversaciones abiertas', 'Escribe las respuestas tipo', 'Lee las valoraciones de la semana'] },
      agentes: [
        { id: 'atencion-1', nombre: 'Agente de soporte', puesto: 'Soporte', oficina: 'atencion',
          tareas: ['Lee el mensaje de un cliente', 'Escribe la respuesta', 'Busca en internet: solución a una incidencia'] },
        { id: 'atencion-2', nombre: 'Agente de seguimiento', puesto: 'Seguimiento', oficina: 'entrega',
          tareas: ['Lee el estado de un pedido', 'Escribe el aviso de envío', 'Escribe la encuesta de satisfacción'] },
      ],
    },
    {
      id: 'contenido',
      nombre: 'Contenido',
      color: '#d98a2b',
      responsable: { nombre: 'Responsable de contenido', tareas: ['Planifica el calendario', 'Revisa los textos del equipo', 'Lee los números de las redes'] },
      agentes: [
        { id: 'contenido-1', nombre: 'Agente de redes', puesto: 'Redes sociales', oficina: 'contenido',
          tareas: ['Busca en internet: tendencias de la semana', 'Escribe el guion de un vídeo', 'Escribe los textos de las publicaciones'] },
        { id: 'contenido-2', nombre: 'Agente de blog', puesto: 'Blog y web', oficina: 'investigacion',
          tareas: ['Lee las preguntas de los clientes', 'Busca en internet: palabras clave', 'Escribe un artículo del blog'] },
        { id: 'contenido-3', nombre: 'Agente de diseño', puesto: 'Diseño', oficina: 'pizarra', dibujo: 'wireframe',
          tareas: ['Escribe las ideas de portada', 'Lee la guía de marca', 'Escribe los textos del anuncio'] },
      ],
    },
  ],
};
