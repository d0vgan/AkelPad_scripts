﻿var tbPlugName = AkelPad.GetArgValue("toolBarName", "ToolBar");

function _localize(s) {
	var strings = {
		"ToolBarText data is empty!": {
			ru: "Содержимое ToolBarText пустое!"
		},
		"ToolBarText data not recognized:\n%S": {
			ru: "Содержимое ToolBarText не распознано:\n%S"
		},
		"Failed to read settings of %S plugin": {
			ru: "Не удалось прочитать настройки плагина %S"
		},
		"Failed to write settings of %S plugin": {
			ru: "Не удалось записать настройки плагина %S"
		}
	};
	var lng = "en";
	switch(AkelPad.GetLangId(1 /*LANGID_PRIMARY*/)) {
		case 0x19: lng = "ru";
	}
	_localize = function(s) {
		return strings[s] && strings[s][lng] || s;
	};
	return _localize(s);
}

var oSet = AkelPad.ScriptSettings();
var hMainWnd = AkelPad.GetMainWnd();
var isHex = AkelPad.SendMessage(hMainWnd, 1222 /*AKD_GETMAININFO*/, 5 /*MI_SAVESETTINGS*/, 0) == 2 /*SS_INI*/;

if(oSet.Begin(tbPlugName, 0x21 /*POB_READ|POB_PLUGS*/)) {
	var tbData = oSet.Read("ToolBarText", 3 /*PO_STRING*/);
	oSet.End();
	if(
		!tbData
		|| isHex && (tbData.length % 4 || /[^\dA-F]/i.test(tbData))
	) {
		error(
			tbData
				? _localize("ToolBarText data not recognized:\n%S").replace("%S", tbData.substr(0, 100))
				: _localize("ToolBarText data is empty!")
		);
		WScript.Quit();
	}
}
else {
	error(_localize("Failed to read settings of %S plugin").replace("%S", tbPlugName));
}

if(tbData && oSet.Begin(tbPlugName, 0x22 /*POB_SAVE|POB_PLUGS*/)) {
	var tbText = isHex ? hexToStr(tbData) : tbData;
	tbText = tbText.replace(/\r(#?)BREAK\r/g, function(s, commented) {
		return "\r" + (commented ? "" : "#") + "BREAK\r";
	});
	tbData = isHex ? strToHex(tbText) : tbText;
	oSet.Write("ToolBarText", 3 /*PO_STRING*/, tbData);
	oSet.End();

	if(AkelPad.IsPluginRunning(tbPlugName + "::Main")) {
		AkelPad.Call(tbPlugName + "::Main");
		AkelPad.Call(tbPlugName + "::Main");
	}
}
else {
	tbData && error(_localize("Failed to write settings of %S plugin").replace("%S", tbPlugName));
}

function hexToStr(h) {
	return h.replace(/[\dA-F]{4}/ig, function(h) {
		var n = parseInt(reorder(h), 16);
		return String.fromCharCode(n);
	});
}
function strToHex(s) {
	return s.replace(/[\s\S]/g, function(c) {
		var h = c.charCodeAt(0).toString(16).toUpperCase();
		h = "0000".substr(h.length) + h;
		return reorder(h);
	});
}
function reorder(h) { // LE <-> BE
	var b1 = h.substr(0, 2);
	var b2 = h.substr(2);
	return b2 + b1;
}

function error(msg) {
	AkelPad.MessageBox(hMainWnd, msg, WScript.ScriptName, 16 /*MB_ICONERROR*/);
}