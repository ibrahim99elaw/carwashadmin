const DB = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const useFB = !!(cfg && cfg.apiKey && window.firebase);
  let fs;
  if (useFB) { firebase.initializeApp(cfg); fs = firebase.firestore(); }
  const ls = c => JSON.parse(localStorage.getItem('cw_' + c) || '[]');
  const save = (c, a) => localStorage.setItem('cw_' + c, JSON.stringify(a));
  const defaults = {
    ownerPin: '1234',
    litersPerWash: 40,
    services: [{ name: 'غسيل خارجي', price: 50 }, { name: 'داخلي وخارجي', price: 100 }]
  };
  return {
    mode: useFB ? 'سحابي' : 'تجريبي محلي',
    async list(c) {
      if (useFB) { const s = await fs.collection(c).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
      return ls(c);
    },
    async add(c, o) {
      if (useFB) { const r = await fs.collection(c).add(o); return r.id; }
      const a = ls(c); o.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      a.push(o); save(c, a); return o.id;
    },
    async remove(c, id) {
      if (useFB) return fs.collection(c).doc(id).delete();
      save(c, ls(c).filter(x => x.id !== id));
    },
    async getSettings() {
      if (useFB) { const d = await fs.collection('settings').doc('main').get(); return { ...defaults, ...(d.exists ? d.data() : {}) }; }
      return { ...defaults, ...JSON.parse(localStorage.getItem('cw_settings') || '{}') };
    },
    async saveSettings(s) {
      if (useFB) return fs.collection('settings').doc('main').set(s);
      localStorage.setItem('cw_settings', JSON.stringify(s));
    }
  };
})();
