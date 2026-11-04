/* Configuração do site · Tasca Beach Club
   Para ligar as reservas de verdade, cole aqui a URL e a chave "anon" do Supabase
   (Supabase > Project Settings > API). Sem elas, o site roda em MODO DEMONSTRAÇÃO:
   as reservas ficam só no navegador de quem testou. */
window.TASCA = {
  supabaseUrl: 'https://mgourqtxbyiagmqzvfwo.supabase.co',      // ex: 'https://abcdefgh.supabase.co'
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nb3VycXR4YnlpYWdtcXp2ZndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTU4MTMsImV4cCI6MjEwNzU3MTgxM30.W3stf81Ia9uyr-VQxlwXuirl0JQhEJRYPexi-Xae650',  // ex: 'eyJhbGciOi...'

  clube: 'Tasca Beach Club',
  whatsapp: '5515992771919',
  whatsappLabel: '(15) 99277-1919',
  instagram: 'tascabeachclub',
  endereco: 'Av. Dr. Armando Pannunzio, 1920 · Jardim Vera Cruz · Sorocaba, SP · 18050-000',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Tasca+Beach+Club+Av.+Dr.+Armando+Pannunzio+1920+Sorocaba',
  googleNota: 4.4,
  googleAvaliacoes: 187,

  // Valores padrão. Quando o Supabase estiver ligado, o painel /admin manda nestes números.
  precoHora: 90,
  quadras: 6,
  diasAntecedencia: 14,
  // 0 = domingo ... 6 = sábado · [abre, fecha] em horas cheias · null = fechado
  horarios: { 0: null, 1: [16, 23], 2: [16, 22], 3: [16, 22], 4: [16, 22], 5: [16, 22], 6: [8, 22] },
  esportes: [
    { id: 'volei', nome: 'Vôlei de praia' },
    { id: 'beach-tennis', nome: 'Beach tennis' },
    { id: 'futevolei', nome: 'Futevôlei' }
  ]
};
