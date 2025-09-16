const DEFAULT_SETTINGS = {
	defaultTemplate: "",
	defaultDisposition: "currentTab", // currentTab | newForegroundTab | newBackgroundTab
	aliases: [
		// Example token alias:
		// { id, name:"GitHub PR", type:"tokens", pattern:"gh :owner :repo pr :num", template:"https://github.com/{owner}/{repo}/pull/{num}", enabled:true, disposition:"currentTab" }
	],
};

function cryptoRandomId() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getSettings() {
	const data = await chrome.storage.sync.get([
		"defaultTemplate",
		"defaultDisposition",
		"aliases",
	]);
	return {
		...DEFAULT_SETTINGS,
		...data,
		aliases: data.aliases || [],
	};
}

function tokenizePattern(pattern) {
	// returns {parts: ["gh"," :owner"," :repo"," pr"," :num"], names:["owner","repo","num"]}
	const names = [];
	// Split by spaces to simple tokens; support quoted segments later if needed
	const tokens = pattern.trim().split(/\s+/);
	const parts = tokens.map((t) => {
		if (t.startsWith(":")) {
			names.push(t.slice(1));
			return { type: "var", name: t.slice(1) };
		}
		return { type: "lit", value: t };
	});
	return { parts, names };
}

function matchTokens(pattern, text) {
	// Try to match tokenized pattern against text split by spaces
	const { parts } = tokenizePattern(pattern);
	const tokens = text.trim().split(/\s+/);
	if (tokens.length < parts.filter((p) => p.type === "lit").length) return null;
	let i = 0;
	let j = 0;
	const vars = {};
	while (i < parts.length && j < tokens.length) {
		const p = parts[i];
		if (p.type === "lit") {
			if (tokens[j] !== p.value) return null;
			i++;
			j++;
		} else {
			// var: consume one token (greedy single for now)
			vars[p.name] = tokens[j];
			i++;
			j++;
		}
	}
	if (i < parts.length) return null; // pattern not fully matched
	// Remaining tokens go to {rest}
	const rest = tokens.slice(j).join(" ");
	return { vars, rest };
}

function applyTemplate(template, vars) {
	let out = template;
	for (const [k, v] of Object.entries(vars)) {
		out = out.replaceAll(`{${k}}`, encodeURIComponent(v));
	}
	// special {rest} and {q} placeholders
	if (vars.rest != null)
		out = out.replaceAll("{rest}", encodeURIComponent(vars.rest));
	if (vars.q != null) out = out.replaceAll("{q}", encodeURIComponent(vars.q));
	return out;
}

function applyExact(pattern, template, text) {
	if (text === pattern) return template;
	return null;
}

function applyPrefix(pattern, template, text) {
	if (!text.startsWith(pattern)) return null;
	const rest = text.slice(pattern.length);
	return template.replaceAll("{*}", encodeURIComponent(rest));
}

function applyRegex(pattern, template, text) {
	let re;
	try {
		re = new RegExp(pattern);
	} catch {
		return null;
	}
	const m = text.match(re);
	if (!m) return null;
	let out = template;
	for (let i = 1; i < m.length; i++) {
		out = out.replaceAll(`$${i}`, encodeURIComponent(m[i]));
	}
	return out;
}

function applyTokens(pattern, template, text) {
	const res = matchTokens(pattern, text);
	if (!res) return null;
	const vars = { ...res.vars, rest: res.rest, q: res.rest };
	return applyTemplate(template, vars);
}

function explodeMultiUrls(urlOrBlock) {
	// allow multiple URLs separated by newline or |
	const parts = urlOrBlock
		.split(/\n|\s+\|\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	return parts;
}

async function resolveAllUrls(text) {
	const { aliases, defaultTemplate } = await getSettings();
	for (const a of aliases) {
		if (!a.enabled) continue;
		let url = null;
		if (a.type === "exact") url = applyExact(a.pattern, a.template, text);
		else if (a.type === "prefix")
			url = applyPrefix(a.pattern, a.template, text);
		else if (a.type === "regex") url = applyRegex(a.pattern, a.template, text);
		else if (a.type === "tokens")
			url = applyTokens(a.pattern, a.template, text);
		if (url) return explodeMultiUrls(url);
	}
	if (defaultTemplate) {
		return explodeMultiUrls(
			defaultTemplate.replaceAll("{q}", encodeURIComponent(text)),
		);
	}
	return null;
}

async function getDispositionForInput(text) {
	const { aliases, defaultDisposition } = await getSettings();
	for (const a of aliases) {
		if (!a.enabled) continue;
		let matched = false;
		if (a.type === "exact" && text === a.pattern) matched = true;
		if (a.type === "prefix" && text.startsWith(a.pattern)) matched = true;
		if (a.type === "regex") {
			try {
				matched = new RegExp(a.pattern).test(text);
			} catch {}
		}
		if (a.type === "tokens" && matchTokens(a.pattern, text)) matched = true;
		if (matched) return a.disposition || defaultDisposition || "currentTab";
	}
	return defaultDisposition || "currentTab";
}

chrome.omnibox.setDefaultSuggestion({
	description: "go → alias (exact, tokens, prefix, regex, multi-URL)",
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
	const { aliases } = await getSettings();
	const rows = [];
	for (const a of aliases) {
		if (!a.enabled) continue;
		let matched = false;
		if (a.type === "exact" && text === a.pattern) matched = true;
		if (a.type === "prefix" && text.startsWith(a.pattern)) matched = true;
		if (a.type === "regex") {
			try {
				matched = new RegExp(a.pattern).test(text);
			} catch {}
		}
		if (a.type === "tokens" && matchTokens(a.pattern, text)) matched = true;
		if (matched) {
			rows.push({ content: text, description: `${a.name} → ${a.template}` });
		}
	}
	if (rows.length) suggest(rows.slice(0, 6));
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
	const urls = await resolveAllUrls(text);
	const openDisp = await getDispositionForInput(text);
	if (!urls || urls.length === 0) return;

	// open first according to disposition, others in background
	const openOne = (u, disp) => {
		if (disp === "currentTab") chrome.tabs.update({ url: u });
		else if (disp === "newForegroundTab") chrome.tabs.create({ url: u });
		else if (disp === "newBackgroundTab")
			chrome.tabs.create({ url: u, active: false });
		else chrome.tabs.update({ url: u });
	};
	openOne(urls[0], openDisp);
	for (let i = 1; i < urls.length; i++) {
		chrome.tabs.create({ url: urls[i], active: false });
	}
});

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "open-as-alias",
		title: "Open as alias",
		contexts: ["selection"],
	});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId === "open-as-alias" && info.selectionText) {
		const text = info.selectionText.trim();
		const urls = await resolveAllUrls(text);
		if (urls) {
			for (const u of urls) chrome.tabs.create({ url: u });
		}
	}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg && msg.type === "resolve") {
		resolveAllUrls(msg.text).then((urls) => sendResponse(urls));
		return true;
	}
	if (msg && msg.type === "getSettings") {
		getSettings().then((s) => sendResponse(s));
		return true;
	}
	if (msg && msg.type === "setSettings") {
		chrome.storage.sync.set(msg.data || {}).then(() => sendResponse(true));
		return true;
	}
});
