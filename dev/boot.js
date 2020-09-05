
(win => {

const
	doc = win.document,
	app = doc.getElementById('rl-app'),
	options = app && app.dataset.boot && JSON.parse(app.dataset.boot) || {},

	Storage = type => {
		let name = type+'Storage';
		try {
			win[name].setItem('storage', '');
			win[name].getItem('storage');
			win[name].removeItem('storage');
		} catch (e) {
			console.error(e);
			const cookieName = encodeURIComponent(name+('session' === type ? win.name || (win.name = Date.now()) : ''));

			// initialise if there's already data
			let data = document.cookie.match('(^|;) ?'+cookieName+'=([^;]*)(;|$)');
			data = data ? decodeURIComponent(data[2]) : null;
			data = data ? JSON.parse(data) : {};

			win[name] = {
				getItem: key => data[key] === undefined ? null : data[key],
				setItem: function (key, value) {
					data[key] = ''+value; // forces the value to a string
					document.cookie = cookieName+'='+encodeURIComponent(JSON.stringify(data))
						+"; expires="+('local' === type ? (new Date(Date.now()+(365*24*60*60*1000))).toGMTString() : '')
						+"; path=/; samesite=strict";
				}
			};
		}
	},
	STORAGE_KEY = '__rlA',
	TIME_KEY = '__rlT',
	AUTH_KEY = 'AuthAccountHash',
	storage = () => window.sessionStorage,
	timestamp = () => Math.round(Date.now() / 1000),
	setTimestamp = () => storage().setItem(TIME_KEY, timestamp()),

	showError = () => {
		const oR = doc.getElementById('rl-loading'),
			oL = doc.getElementById('rl-loading-error');

		if (oR) {
			oR.style.display = 'none';
		}

		if (oL) {
			oL.style.display = 'block';
		}

		p.end();
	},

	runMainBoot = withError => {
		if (win.__APP_BOOT && !withError) {
			win.__APP_BOOT(() => showError());
		} else {
			showError();
		}
	},

	writeCSS = css => {
		const style = doc.createElement('style');
		style.type = 'text/css';
		style.textContent = css;
		doc.head.append(style);
	},

	loadScript = src => {
		if (!src) {
			throw new Error('src should not be empty.');
		}
		return new Promise((resolve, reject) => {
			const script = doc.createElement('script');
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(src));
			script.src = src;
			doc.head.append(script);
		});
	},

	p = win.progressJs = {
		set: percent => progress.style.width = Math.min(percent, 100) + '%',
		end: () => {
			if (container) {
				p.set(100);
				setTimeout(() => {
					container.remove();
					container = progress = null;
				}, 600);
			}
		}
	};

if (!navigator || !navigator.cookieEnabled) {
	doc.location.replace('./?/NoCookie');
}

let container = doc.querySelector('.progressjs'),
	progress = doc.querySelector('.progressjs-inner'),

	RL_APP_DATA_STORAGE = {};

p.set(1);

Storage('local');
Storage('session');

win.rl = {
	hash: {
		// getHash
		get: () => storage().getItem(STORAGE_KEY) || null,
		// setHash
		set: () => {
			storage().setItem(STORAGE_KEY, RL_APP_DATA_STORAGE && RL_APP_DATA_STORAGE[AUTH_KEY]
				? RL_APP_DATA_STORAGE[AUTH_KEY] : '');
			setTimestamp();
		},
		// clearHash
		clear: () => {
			storage().setItem(STORAGE_KEY, '');
			setTimestamp();
		},
		// checkTimestamp
		check: () => {
			if (timestamp() > (parseInt(storage().getItem(TIME_KEY) || 0, 10) || 0) + 3600000) {
				// 60m
				rl.hash.clear();
				return true;
			}
			return false;
		}
	},
	data: () => RL_APP_DATA_STORAGE,
	adminArea: () => options.admin,
	settings: {
		get: name => null == RL_APP_DATA_STORAGE[name] ? null : RL_APP_DATA_STORAGE[name],
		set: (name, value) => RL_APP_DATA_STORAGE[name] = value,
		app: name => {
			const APP_SETTINGS = RL_APP_DATA_STORAGE.System || {};
			return null == APP_SETTINGS[name] ? null : APP_SETTINGS[name];
		},
		capa: name => null != name && Array.isArray(RL_APP_DATA_STORAGE.Capa) && RL_APP_DATA_STORAGE.Capa.includes(name)
	},
	setWindowTitle: title => {
		title = null == title ? '' : '' + title;
		if (RL_APP_DATA_STORAGE.Title) {
			title += (title ? ' - ' : '') + RL_APP_DATA_STORAGE.Title;
		}
		document.title = null == title ? '' : '' + title;
	}
};

// init section
setInterval(setTimestamp, 60000); // 1m

/**
 * @param {mixed} appData
 * @returns {void}
 */
win.__initAppData = appData => {
	RL_APP_DATA_STORAGE = appData;

	rl.hash.set();

	if (appData) {
		if (appData.NewThemeLink) {
			(doc.getElementById('app-theme-link') || {}).href = appData.NewThemeLink;
		}

		appData.IncludeCss && writeCSS(appData.IncludeCss);
	}

	if (
		appData &&
		appData.TemplatesLink &&
		appData.LangLink &&
		appData.StaticLibJsLink &&
		appData.StaticAppJsLink &&
		appData.StaticEditorJsLink
	) {
		p.set(5);

		const libs = () =>
			loadScript(appData.StaticLibJsLink).then(() => {
				doc.getElementById('rl-check').remove();
				if (appData.IncludeBackground) {
					const img = appData.IncludeBackground.replace('{{USER}}', rl.hash.get() || '0');
					if (img) {
						doc.documentElement.classList.add('UserBackground');
						doc.body.style.backgroundImage = "url("+img+")";
					}
				}
			});

		libs()
			.then(() => {
				p.set(20);
				return Promise.all([loadScript(appData.TemplatesLink), loadScript(appData.LangLink)]);
			})
			.then(() => {
				p.set(30);
				return loadScript(appData.StaticAppJsLink);
			})
			.then(() => {
				p.set(50);
				return appData.PluginsLink ? loadScript(appData.PluginsLink) : Promise.resolve();
			})
			.then(() => {
				p.set(70);
				runMainBoot(false);
			})
			.catch((e) => {
				runMainBoot(true);
				throw e;
			})
			.then(() => loadScript(appData.StaticEditorJsLink))
			.then(() => {
				if (win.CKEDITOR && win.__initEditor) {
					win.__initEditor();
					win.__initEditor = null;
				}
			});
	} else {
		runMainBoot(true);
	}
};

if (app) {
	['app-css','app-theme-link'].forEach(css => {
		css = doc.getElementById(css);
		css.href = css.dataset.href;
	});

	loadScript('./?/'
		+ (options.admin ? 'Admin' : '')
		+ 'AppData@'
		+ (options.mobile ? 'mobile' : 'no-mobile')
		+ (options.mobileDevice ? '-1' : '-0')
		+ '/'
		+ (rl.hash.get() || '0')
		+ '/'
		+ Math.random().toString().substr(2)
		+ '/').then(() => {});
}

})(this);
