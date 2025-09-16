function qs(id) {
	return document.getElementById(id);
}
function escapeHtml(s) {
	return s.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
}

function rowHtml(a) {
	const tplShort = a.template.split(/\n/)[0];
	return `<tr data-id="${a.id}">
    <td>${escapeHtml(a.name || "")}</td>
    <td>${a.type}</td>
    <td><code>${escapeHtml(a.pattern)}</code></td>
    <td><code>${escapeHtml(tplShort)}${a.template.includes("\n") ? " …" : ""}</code></td>
    <td>${a.disposition || "currentTab"}</td>
    <td>${a.enabled ? "✅" : "⛔️"}</td>
    <td class="actions">
      <button class="edit">Edit</button>
      <button class="toggle">${a.enabled ? "Disable" : "Enable"}</button>
      <button class="delete">Delete</button>
    </td>
  </tr>`;
}

async function loadState() {
	const {
		aliases = [],
		defaultTemplate = "",
		defaultDisposition = "currentTab",
	} = await chrome.storage.sync.get([
		"aliases",
		"defaultTemplate",
		"defaultDisposition",
	]);
	return { aliases, defaultTemplate, defaultDisposition };
}
async function saveState(aliases, defaultTemplate, defaultDisposition) {
	await chrome.storage.sync.set({
		aliases,
		defaultTemplate,
		defaultDisposition,
	});
}
function formToAlias() {
	const id = qs("save").dataset.editingId || null;
	return {
		id: id || Math.random().toString(36).slice(2) + Date.now().toString(36),
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
	qs("type").value = a.type;
	qs("pattern").value = a.pattern;
	qs("template").value = a.template;
	qs("enabled").value = a.enabled ? "true" : "false";
	qs("disposition").value = a.disposition || "currentTab";
	qs("save").dataset.editingId = a.id;
}
function resetForm() {
	qs("name").value = "";
	qs("type").value = "tokens";
	qs("pattern").value = "";
	qs("template").value = "";
	qs("enabled").value = "true";
	qs("disposition").value = "currentTab";
	delete qs("save").dataset.editingId;
}
async function render() {
	const state = await loadState();
	qs("rows").innerHTML = state.aliases.map(rowHtml).join("");
	qs("defaultTemplate").value = state.defaultTemplate || "";
	qs("defaultDisposition").value = state.defaultDisposition || "currentTab";
}
document.addEventListener("click", async (e) => {
	const row = e.target.closest("tr[data-id]");
	if (!row) return;
	const id = row.dataset.id;
	const { aliases, defaultTemplate, defaultDisposition } = await loadState();
	const idx = aliases.findIndex((a) => a.id === id);
	if (idx === -1) return;
	if (e.target.classList.contains("edit")) {
		fillForm(aliases[idx]);
	} else if (e.target.classList.contains("toggle")) {
		aliases[idx].enabled = !aliases[idx].enabled;
		await saveState(aliases, defaultTemplate, defaultDisposition);
		render();
	} else if (e.target.classList.contains("delete")) {
		aliases.splice(idx, 1);
		await saveState(aliases, defaultTemplate, defaultDisposition);
		render();
	}
});
qs("save").addEventListener("click", async () => {
	const alias = formToAlias();
	if (!alias.name || !alias.pattern || !alias.template) {
		alert("Please fill name, pattern, and template.");
		return;
	}
	const { aliases, defaultTemplate, defaultDisposition } = await loadState();
	const editingId = qs("save").dataset.editingId;
	if (editingId) {
		const idx = aliases.findIndex((a) => a.id === editingId);
		if (idx !== -1) aliases[idx] = alias;
	} else {
		aliases.push(alias);
	}
	await saveState(aliases, defaultTemplate, defaultDisposition);
	resetForm();
	render();
});
qs("reset").addEventListener("click", () => resetForm());
qs("saveSettings").addEventListener("click", async () => {
	const { aliases } = await loadState();
	await saveState(
		aliases,
		qs("defaultTemplate").value.trim(),
		qs("defaultDisposition").value,
	);
	alert("Defaults saved.");
});
qs("export").addEventListener("click", async () => {
	const state = await loadState();
	const blob = new Blob([JSON.stringify(state, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "alias-router-pro-export.json";
	a.click();
	URL.revokeObjectURL(url);
});
qs("importBtn").addEventListener("click", async () => {
	const file = qs("importFile").files[0];
	if (!file) return alert("Choose a JSON file to import.");
	const text = await file.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		return alert("Invalid JSON.");
	}
	if (!data || !Array.isArray(data.aliases))
		return alert("JSON must contain an 'aliases' array.");
	await saveState(
		data.aliases,
		data.defaultTemplate || "",
		data.defaultDisposition || "currentTab",
	);
	render();
});
render();
