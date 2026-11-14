// ============================================================
//  OFICINA VIRTUAL 3D · CONFIGURACIÓN DE ACU-ABAE CATALUNYA
//  Cambia aquí el nombre, los departamentos, los colores y los agentes.
//  La actividad es una SIMULACIÓN: aquí no van datos reales de socios ni claves.
// ============================================================
window.OFICINA = {
  // Nombre que flota sobre el núcleo central y sale en la cabecera
  empresa: 'ASSOCIACIÓ ACU-ABAE CATALUNYA',
  lema: 'Oficina virtual 3D',
  colorCentral: '#00BDB1',

  // Recepción, en el centro (pon `recepcion: false` para quitarla)
  recepcion: {
    nombre: 'Recepción',
    tareas: ['Lee una consulta nueva y decide a qué departamento pasarla', 'Busca en internet: organismo competente para una reclamación', 'Escribe el mensaje de bienvenida'],
  },

  // Cada departamento es un edificio (máximo 5). Cada agente tiene su propia oficina dentro.
  // `oficina` decide cómo se amuebla su puesto. Tipos: ventas, captacion, atencion, contenido, investigacion,
  // desarrollo, entrega, finanzas, direccion, pizarra, servidores, seguridad, laboratorio, comunidad, academia,
  // analitica, formacion.
  // `estado` (opcional): 'funciona' (por defecto), 'a_medias' o 'no_existe' (sale en obras y sin agente).
  // Las tareas que empiezan por «Busca en internet» o «Lee» cambian el holograma que flota sobre el agente.
  departamentos: [
    {
      id: 'juridico',
      nombre: 'Jurídico',
      color: '#2f7fe0',
      responsable: { nombre: 'Responsable jurídico', tareas: ['Reparte los asuntos del día', 'Revisa los escritos del equipo', 'Lee los plazos que vencen esta semana'] },
      agentes: [
        { id: 'juridico-1', nombre: 'Agente de reclamaciones', puesto: 'Redacción de reclamaciones', oficina: 'entrega',
          tareas: ['Lee la documentación de un caso', 'Busca en internet: normativa de consumo aplicable', 'Escribe la reclamación extrajudicial'] },
        { id: 'juridico-2', nombre: 'Agente de informes jurídicos', puesto: 'Redacción de informes jurídicos', oficina: 'investigacion',
          tareas: ['Lee un contrato y sus condiciones generales', 'Busca en internet: jurisprudencia reciente', 'Escribe el informe jurídico'] },
        { id: 'juridico-3', nombre: 'Agente de demandas', puesto: 'Redacción de demandas judiciales', oficina: 'direccion',
          tareas: ['Lee los hechos y las pruebas del asunto', 'Busca en internet: doctrina del Tribunal Supremo', 'Escribe la demanda judicial'] },
      ],
    },
    {
      id: 'atencion',
      nombre: 'Atención',
      color: '#2fae6e',
      responsable: { nombre: 'Responsable de atención', tareas: ['Revisa las consultas abiertas', 'Escribe las respuestas tipo', 'Lee las valoraciones de la semana'] },
      agentes: [
        { id: 'atencion-1', nombre: 'Agente de respuestas', puesto: 'Respuestas a consultas', oficina: 'atencion',
          tareas: ['Lee la consulta de un socio', 'Busca en internet: información oficial sobre el trámite', 'Escribe la respuesta'] },
      ],
    },
    {
      id: 'contenido',
      nombre: 'Contenido',
      color: '#e09a2b',
      responsable: { nombre: 'Responsable de contenido', tareas: ['Planifica el calendario de publicaciones', 'Revisa los textos del equipo', 'Lee los resultados de las redes'] },
      agentes: [
        { id: 'contenido-1', nombre: 'Agente de redes', puesto: 'Redes sociales', oficina: 'contenido',
          tareas: ['Busca en internet: novedades de consumo de la semana', 'Lee la guía de estilo de la asociación', 'Escribe los textos de las publicaciones'] },
      ],
    },
  ],
};
