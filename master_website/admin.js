
/* Cool animated menu injected via JS
	 - Creates a floating hamburger that toggles a sliding sidebar
	 - Supports nested submenus and keyboard/escape close
	 - Self-contained CSS + DOM insertion
*/
(function(){
	if (typeof document === 'undefined') return;

	document.addEventListener('DOMContentLoaded', function(){
		// CSS
		var css = ""+
			"#cool-menu{position:fixed;left:18px;top:18px;z-index:9999;font-family:Segoe UI,Roboto,Arial,sans-serif}"+
			"#cool-menu .hamburger{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#0f172a,#0b1220);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 18px rgba(2,6,23,.6);cursor:pointer;transition:transform .25s ease}"+
			"#cool-menu .hamburger:active{transform:scale(.97)}"+
			"#cool-menu .hamburger .bar{width:22px;height:2px;background:#fff;display:block;position:relative;transition:all .28s ease}"+
			"#cool-menu .hamburger .bar:before,#cool-menu .hamburger .bar:after{content:'';position:absolute;left:0;width:22px;height:2px;background:#fff;transition:all .28s ease}"+
			"#cool-menu .hamburger .bar:before{top:-7px}#cool-menu .hamburger .bar:after{top:7px}"+
			"#cool-menu nav{position:fixed;left:18px;top:86px;width:260px;max-width:78vw;background:linear-gradient(180deg,#051126,#07172a);border-radius:12px;padding:12px;box-shadow:0 18px 50px rgba(2,6,23,.6);transform:translateY(-10px) scale(.98);opacity:0;pointer-events:none;transition:all .28s cubic-bezier(.2,.9,.2,1)}"+
			"#cool-menu.open nav{transform:translateY(0) scale(1);opacity:1;pointer-events:auto}"+
			"#cool-menu nav ul{list-style:none;margin:0;padding:6px;display:flex;flex-direction:column;gap:6px;color:#cfe8ff}"+
			"#cool-menu nav a{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;color:inherit;text-decoration:none;transition:background .18s,transform .18s}"+
			"#cool-menu nav a:hover{background:rgba(255,255,255,.04);transform:translateX(6px)}"+
			"#cool-menu .badge{background:linear-gradient(90deg,#06b6d4,#7c3aed);color:#fff;padding:4px 8px;border-radius:999px;font-size:12px}"+
			"#cool-menu .submenu{max-height:0;overflow:hidden;transition:max-height .28s ease;padding-left:8px;margin-left:8px;border-left:1px dashed rgba(255,255,255,.03)}"+
			"#cool-menu .item.has-children > a:after{content:'▸';margin-left:auto;opacity:.7;transform:rotate(0);transition:transform .22s}"+
			"#cool-menu .item.open > a:after{transform:rotate(90deg)}"+
			"#cool-menu .item.open .submenu{max-height:220px;margin-top:6px;margin-bottom:6px}"
		;

		var style = document.createElement('style');
		style.setAttribute('data-generated','cool-menu');
		style.appendChild(document.createTextNode(css));
		document.head.appendChild(style);

		// Markup
		var container = document.createElement('div');
		container.id = 'cool-menu';
		container.innerHTML = '\n' +
			'<div class="hamburger" role="button" aria-label="Open menu" tabindex="0">' +
				'<span class="bar"></span>' +
			'</div>' +
			'<nav aria-hidden="true">' +
				'<ul>' +
					'<li class="item"><a href="#dashboard">Dashboard <span class="badge">New</span></a></li>' +
					'<li class="item has-children"><a href="#settings">Settings</a>' +
						'<div class="submenu">' +
							'<a href="#profile">Profile</a>' +
							'<a href="#appearance">Appearance</a>' +
							'<a href="#integrations">Integrations</a>' +
						'</div>' +
					'</li>' +
					'<li class="item"><a href="#devices">Devices</a></li>' +
					'<li class="item has-children"><a href="#help">Help</a>' +
						'<div class="submenu">' +
							'<a href="#docs">Docs</a>' +
							'<a href="#support">Support</a>' +
						'</div>' +
					'</li>' +
					'<li class="item"><a href="#logout">Sign out</a></li>' +
				'</ul>' +
			'</nav>';

		document.body.appendChild(container);

		var hamburger = container.querySelector('.hamburger');
		var nav = container.querySelector('nav');

		function toggleMenu(open){
			var isOpen = container.classList.contains('open');
			var want = typeof open === 'boolean' ? open : !isOpen;
			if (want){
				container.classList.add('open');
				nav.setAttribute('aria-hidden','false');
			} else {
				container.classList.remove('open');
				nav.setAttribute('aria-hidden','true');
			}
		}

		hamburger.addEventListener('click', function(e){ toggleMenu(); });
		hamburger.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); toggleMenu(); }});

		// Submenu toggles
		Array.from(container.querySelectorAll('.item.has-children')).forEach(function(it){
			var a = it.querySelector('a');
			a.addEventListener('click', function(e){
				e.preventDefault();
				it.classList.toggle('open');
			});
		});

		// Close on outside click or Escape
		document.addEventListener('click', function(e){
			if (!container.contains(e.target)) toggleMenu(false);
		});
		document.addEventListener('keydown', function(e){ if(e.key==='Escape') toggleMenu(false); });

		// Small stagger animation for items when opening
		var items = container.querySelectorAll('nav ul > .item');
		var observer = new MutationObserver(function(){
			if (container.classList.contains('open')){
				items.forEach(function(it,i){ it.style.transition = 'transform .28s ease '+(i*0.03)+'s, opacity .28s '+(i*0.03)+'s'; it.style.transform='translateX(0)'; it.style.opacity=1; });
			} else {
				items.forEach(function(it){ it.style.transition='none'; it.style.transform='translateX(-6px)'; it.style.opacity=.85; });
			}
		});
		observer.observe(container,{attributes:true,attributeFilter:['class']});

		// Initial collapsed appearance
		items.forEach(function(it){ it.style.transform='translateX(-6px)'; it.style.opacity=.85; });
	});
})();
