/* WEATHER SERVICE — Bản bảo hiểm chống trùng lặp */
(function() {
  if (window.WeatherService) return; // ⚡ Nếu đã có thì bỏ qua, không khai báo lại

  const WeatherService = {
      // ⚡ Khởi tạo sẵn dữ liệu mặc định để không bao giờ bị null
    _cache: null,
    _cacheTs: 0,
    TTL: 15 * 60 * 1000,
    LAT: 10.8231,
    LNG: 106.6297,

    async get() {
      if (this._cache && Date.now() - this._cacheTs < this.TTL) return this._cache;
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.LAT}&longitude=${this.LNG}&current_weather=true&timezone=Asia/Ho_Chi_Minh`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API fail');
        const data = await res.json();
        const cw = data.current_weather;
        this._cache = {
          temp: Math.round(cw.temperature),
          code: cw.weathercode,
          desc: this._codeToVN(cw.weathercode),
          isHot: cw.temperature >= 28,
          isCold: cw.temperature <= 22,
          isRainy: (cw.weathercode >= 51 && cw.weathercode <= 67) || (cw.weathercode >= 80 && cw.weathercode <= 82),
          real: true,
          ts: Date.now()
        };
      } catch (e) {
        const h = new Date().getHours();
        this._cache = {
          temp: 28, code: 0, desc: 'Trời dịu (fallback)',
          isHot: h >= 11 && h <= 15, isCold: false, isRainy: false, real: false, ts: Date.now()
        };
      }
      this._cacheTs = Date.now();
      return this._cache;
    },

    _codeToVN(c) {
      if (c === 0) return 'Trời quang';
      if (c <= 3) return 'Có mây';
      if (c <= 48) return 'Sương mù';
      if (c <= 67) return 'Mưa';
      if (c <= 77) return 'Tuyết';
      if (c <= 82) return 'Mưa rào';
      return 'Dông';
    },

    preload() { this.get().catch(() => {}); }
  };

  window.WeatherService = WeatherService;
  WeatherService.preload();
})();