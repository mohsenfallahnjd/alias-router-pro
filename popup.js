function qs(id) {
	return document.getElementById(id);
}

const state = { aliases: [], editingId: null };

function formToAlias() {
	return {
		id:
			state.editingId ||
			Math.random().toString(36).slice(2) + Date.now().toString(36),
		name: qs("name").value.trim(),
		type: qs("type").value,
		pattern: qs("pattern").value.trim(),
		template: qs("template").value.trim(),
		enabled: qs("enabled").value === "true",
		disposition: qs("disposition").value,
	};
}

function fillForm(a) {
	qs("name").value = a.name || "";
	qs("type").value = a.type || "tokens";
	qs("pattern").value = a.pattern || "";
	qs("template").value = a.template || "";
	qs("enabled").value = a.enabled ? "true" : "false";
	qs("disposition").value = a.disposition || "currentTab";
	state.editingId = a.id;
}

function resetForm() {
	qs("name").value = "";
	qs("type").value = "tokens";
	qs("pattern").value = "";
	qs("template").value = "";
	qs("enabled").value = "true";
	qs("disposition").value = "currentTab";
	state.editingId = null;
}

function itemHtml(a) {
	return `<div class="item" data-id="${a.id}">
	  <div>
		<div><strong>${a.name || "(no name)"}</strong> [${a.type}]</div>
		<div class="meta">${a.pattern} → ${a.template.split(/\n/)[0]}</div>
	  </div>
	  <div class="actions">
		<button class="edit">Edit</button>
		<button class="toggle">${a.enabled ? "Disable" : "Enable"}</button>
	  </div>
	</div>`;
}

function renderList() {
	qs("list").innerHTML = state.aliases.map(itemHtml).join("");
}

function loadSettings() {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage({ type: "getSettings" }, (s) =>
			resolve(s || { aliases: [] }),
		);
	});
}

function saveAliases(aliases) {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage({ type: "setSettings", data: { aliases } }, () =>
			resolve(true),
		);
	});
}

async function init() {
	const s = await loadSettings();
	state.aliases = s.aliases || [];
	renderList();
}

document.addEventListener("click", async (e) => {
	const item = e.target.closest(".item");
	if (item) {
		const id = item.dataset.id;
		const idx = state.aliases.findIndex((a) => a.id === id);
		if (idx !== -1) {
			if (e.target.classList.contains("edit")) fillForm(state.aliases[idx]);
			if (e.target.classList.contains("toggle")) {
				state.aliases[idx].enabled = !state.aliases[idx].enabled;
				await saveAliases(state.aliases);
				renderList();
			}
		}
	}
});

qs("save").addEventListener("click", async () => {
	const a = formToAlias();
	if (!a.pattern || !a.template) return alert("Pattern and Template required.");
	const idx = state.aliases.findIndex((x) => x.id === a.id);
	if (idx === -1) state.aliases.push(a);
	else state.aliases[idx] = a;
	await saveAliases(state.aliases);
	resetForm();
	renderList();
});

qs("reset").addEventListener("click", () => resetForm());

qs("delete").addEventListener("click", async () => {
	if (!state.editingId) return;
	const idx = state.aliases.findIndex((x) => x.id === state.editingId);
	if (idx !== -1) {
		state.aliases.splice(idx, 1);
		await saveAliases(state.aliases);
		resetForm();
		renderList();
	}
});

// OPEN without "tabs" permission: always create new tabs
qs("quickOpen").addEventListener("click", () => {
	const text = qs("quickInput").value.trim();
	if (!text) return;

	chrome.runtime.sendMessage({ type: "resolve", text }, async (urls) => {
		if (!urls || !urls.length) return;

		// first URL in foreground
		await chrome.tabs.create({ url: urls[0], active: true });

		// remaining in background
		for (let i = 1; i < urls.length; i++) {
			chrome.tabs.create({ url: urls[i], active: false });
		}
	});
});

init();
