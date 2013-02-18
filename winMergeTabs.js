// http://akelpad.sourceforge.net/forum/viewtopic.php?p=
// http://infocatcher.ucoz.net/js/akelpad_scripts/winMergeCompareCurrent.js

// (c) Infocatcher 2013
// version 0.1.0pre - 2013-02-18

// Compare contents of current and next selected tabs using WinMerge (http://winmerge.org/)

// Arguments:
//   -path="%ProgramFiles%\\WinMege\\WinMerge.exe"       - path to WinMerge executable
//   -save=true                                          - true  - save file before compare
//                                                         false - use temporary files for unsaved files
//   -temp="%AkelDir%\\AkelFiles\\Plugs\\Scripts\\temp"  - path to temporary directory

function _localize(s) {
	var strings = {
		"No tabs!": {
			ru: "����������� �������!"
		},
		"MDI or PMDI window mode required!": {
			ru: "��������� ������� ����� MDI ��� PMDI!"
		},
		"Select tab!": {
			ru: "�������� �������!"
		}
	};
	var lng;
	switch(AkelPad.GetLangId(1 /*LANGID_PRIMARY*/)) {
		case 0x19: lng = "ru"; break;
		default:   lng = "en";
	}
	_localize = function(s) {
		return strings[s] && strings[s][lng] || s;
	};
	return _localize(s);
}

var path = AkelPad.GetArgValue("path", "");
var save = AkelPad.GetArgValue("save", false);
var tempDir = AkelPad.GetArgValue("temp", "%temp%");

var winMergePaths = path
	? [path]
	: [
		"<HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\WinMergeU.exe\\>",
		"<HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\WinMerge.exe\\>",
		"%ProgramFiles%\\WinMege\\WinMergeU.exe",
		"%ProgramFiles (x86)%\\WinMerge\\WinMergeU.exe",
		"%AkelDir%\\..\\WinMergePortable\\WinMergePortable.exe",
		"%COMMANDER_PATH%\\..\\WinMergePortable\\WinMergePortable.exe"
	];

var hMainWnd = AkelPad.GetMainWnd();
var oSys = AkelPad.SystemFunction();
var fso = new ActiveXObject("Scripting.FileSystemObject");
var wsh = new ActiveXObject("WScript.Shell");

if(
	hMainWnd
	&& AkelPad.IsMDI() // WMD_MDI or WMD_PMDI
) {
	var lpFrame = AkelPad.SendMessage(hMainWnd, 1288 /*AKD_FRAMEFIND*/, 1 /*FWF_CURRENT*/, 0);
	var lpFrame2;
	var hWndEditInitial = AkelPad.GetEditWnd();
	var extInitial = getCurrentExtension(); // We can't (?) use GetEditDoc() for inactive document

	if(lpFrame) {
		var statusbar = new Statusbar();
		statusbar.save();
		var statusMsg = _localize("Select tab!");
		statusbar.set(statusMsg);

		var showDelay = 600;
		var hideDelay = 150;
		try {
			var window = new ActiveXObject("htmlfile").parentWindow;
			var shown = true;
			var timer = window.setTimeout(function blink() {
				statusbar.set(shown ? "" : statusMsg);
				timer = window.setTimeout(blink, (shown = !shown) ? showDelay : hideDelay);
			}, showDelay);
		}
		catch(e) {
		}
	}

	if(lpFrame && AkelPad.WindowSubClass(hMainWnd, mainCallback, 0x416 /*AKDN_FRAME_ACTIVATE*/)) {
		AkelPad.WindowGetMessage(); // Message loop
		AkelPad.WindowUnsubClass(hMainWnd);

		timer && window.clearTimeout(timer);
		statusbar.restore();
		if(lpFrame2)
			compareTabs(lpFrame, lpFrame2);
	}
	else {
		timer && window.clearTimeout(timer);
		statusbar && statusbar.restore();
		AkelPad.MessageBox(hMainWnd, _localize("No tabs!"), WScript.ScriptName, 48 /*MB_ICONEXCLAMATION*/);
	}
}
else {
	AkelPad.MessageBox(hMainWnd, _localize("MDI or PMDI window mode required!"), WScript.ScriptName, 48 /*MB_ICONEXCLAMATION*/);
}
function mainCallback(hWnd, uMsg, wParam, lParam) {
	if(uMsg != 0x416 /*AKDN_FRAME_ACTIVATE*/)
		return;
	lpFrame2 = lParam;
	if(lpFrame2 != lpFrame)
		oSys.Call("user32::PostQuitMessage", 0); // Exit message loop
}

function compareTabs(lpFrame, lpFrame2) {
	var winMerge = getWinMerge();
	if(!winMerge) {
		AkelPad.MessageBox(hMainWnd, _localize("WinMerge not found!"), WScript.ScriptName, 48 /*MB_ICONEXCLAMATION*/);
		return;
	}

	var hWndEdit  = AkelPad.SendMessage(hMainWnd, 1223 /*AKD_GETFRAMEINFO*/, 2 /*FI_WNDEDIT*/, lpFrame);
	var hWndEdit2 = AkelPad.SendMessage(hMainWnd, 1223 /*AKD_GETFRAMEINFO*/, 2 /*FI_WNDEDIT*/, lpFrame2);

	var file  = getFile(lpFrame, hWndEdit);
	var file2 = getFile(lpFrame2, hWndEdit2);

	var cmdLine = '"' + winMerge + '" "' + file + '" "' + file2 + '"';
	var wm = wsh.Exec(cmdLine);
	if(file.isTemp || file2.isTemp) for(;;) {
		WScript.Sleep(1000);
		if(wm.Status != 0) {
			if(file.isTemp)
				fso.DeleteFile(file);
			if(file2.isTemp)
				fso.DeleteFile(file2);
			break;
		}
	}
}
function getFile(lpFrame, hWndEdit) {
	var file = AkelPad.GetEditFile(hWndEdit);
	if(!file || AkelPad.SendMessage(hWndEdit, 3086 /*AEM_GETMODIFY*/, 0, 0)) {
		if(file && save) {
			AkelPad.SaveFile(hWndEdit, file);
			return file;
		}
		var codePage = AkelPad.GetEditCodePage(hWndEdit);
		var hasBOM = AkelPad.GetEditBOM(hWndEdit);
		var tempFile = getTempFile(hWndEdit, file);

		var lpFrameCurr = AkelPad.SendMessage(hMainWnd, 1288 /*AKD_FRAMEFIND*/, 1 /*FWF_CURRENT*/, 0);
		setRedraw(hMainWnd, false);

		//var hWndEditOrig = AkelPad.GetEditWnd();
		//AkelPad.SetEditWnd(hWndEdit);
		AkelPad.SendMessage(hMainWnd, 1285 /*AKD_FRAMEACTIVATE*/, 0, lpFrame);
		var text = AkelPad.GetTextRange(0, -1);
		//AkelPad.SetEditWnd(hWndEditOrig);

		AkelPad.SendMessage(hMainWnd, 273 /*WM_COMMAND*/, 4101 /*IDM_FILE_NEW*/, 0);
		AkelPad.SetSel(0, -1);
		AkelPad.ReplaceSel(text);
		AkelPad.SaveFile(AkelPad.GetEditWnd(), tempFile, codePage, hasBOM);
		AkelPad.Command(4318 /*IDM_WINDOW_FRAMECLOSE*/);

		AkelPad.SendMessage(hMainWnd, 1285 /*AKD_FRAMEACTIVATE*/, 0, lpFrameCurr);
		setRedraw(hMainWnd, true);

		return tempFile;
	}
	return file;
}
function getWinMerge() {
	for(var i = 0, l = winMergePaths.length; i < l; ++i) {
		var path = expandVariables(winMergePaths[i]);
		if(fso.FileExists(path))
			return path;
	}
	return "";
}
function getTempFile(hWndEdit, file) {
	var tmp = file && /[^\/\\]+$/.test(file) && RegExp.lastMatch;
	if(!tmp) {
		var ext = hWndEdit == hWndEditInitial
			? extInitial
			: getCurrentExtension();
		tmp = "akelpad-temp" + ext;
	}
	var tmpDir = expandVariables(tempDir);
	if(!fso.FolderExists(tmpDir))
		fso.CreateFolder(tmpDir);
	tmp = tmpDir + "\\" + tmp;
	var i = 0;
	while(fso.FileExists(tmp))
		tmp = tmp.replace(/(\.[^.]+)?$/, ++i + "$1");
	var out = new String(tmp);
	out.isTemp = true;
	return out;
}
function getCurrentExtension() {
	var alias = getCoderAlias();
	if(/\.[^.]+$/.test(alias))
		return RegExp.lastMatch;
	return ".txt";
}
function getCoderAlias() {
	// http://akelpad.sourceforge.net/forum/viewtopic.php?p=19363#19363
	var hWndEdit = AkelPad.GetEditWnd();
	var hDocEdit = AkelPad.GetEditDoc();
	var pAlias = "";
	if(hWndEdit && hDocEdit) {
		var lpAlias = AkelPad.MemAlloc(256 * 2 /*sizeof(wchar_t)*/);
		if(lpAlias) {
			AkelPad.CallW("Coder::Settings", 18 /*DLLA_CODER_GETALIAS*/, hWndEdit, hDocEdit, lpAlias, 0);
			pAlias = AkelPad.MemRead(lpAlias, 1 /*DT_UNICODE*/);
			AkelPad.MemFree(lpAlias);
		}
	}
	return pAlias;
}

function expandVariables(s) {
	return expandEnvironmentVariables(expandRegistryVariables(s));
}
function expandEnvironmentVariables(s) {
	return wsh.ExpandEnvironmentStrings(s.replace(/^%AkelDir%/, AkelPad.GetAkelDir()));
}
function expandRegistryVariables(s) { // <HKCU\Software\Foo\installPath>\foo.exe
	return s.replace(/<(.+?)>/g, function(s, path) {
		var val = getRegistryValue(path);
		if(val)
			return val;
		return s;
	});
}
function getRegistryValue(path) {
	try {
		return wsh.RegRead(path);
	}
	catch(e) {
	}
	return "";
}

function setRedraw(hWnd, bRedraw) {
	AkelPad.SendMessage(hWnd, 11 /*WM_SETREDRAW*/, bRedraw, 0);
	bRedraw && oSys.Call("user32::InvalidateRect", hWnd, 0, true);
}

function Statusbar() {
	this.get = this.set = this.save = this.restore = function() {};

	// Based on Instructor's code: http://akelpad.sourceforge.net/forum/viewtopic.php?p=13656#13656
	var hWndStatus = oSys.Call("user32::GetDlgItem", hMainWnd, 10002 /*ID_STATUS*/);
	if(!hWndStatus || !oSys.Call("user32::IsWindowVisible", hWndStatus))
		return;
	var nParts = AkelPad.SendMessage(hWndStatus, 1030 /*SB_GETPARTS*/, 0, 0);
	if(nParts <= 5)
		return;
	var _origStatus, _customStatus;
	var _this = this;
	function buffer(callback) {
		var lpTextBuffer = AkelPad.MemAlloc(1024 * _TSIZE);
		if(lpTextBuffer) {
			var ret = callback.call(_this, lpTextBuffer);
			AkelPad.MemFree(lpTextBuffer);
			return ret;
		}
	}
	this.get = function() {
		return buffer(function(lpTextBuffer) {
			AkelPad.SendMessage(hWndStatus, _TSTR ? 1037 /*SB_GETTEXTW*/ : 1026 /*SB_GETTEXTA*/, nParts - 1, lpTextBuffer);
			return AkelPad.MemRead(lpTextBuffer, _TSTR);
		});
	};
	this.set = function(pStatusText) {
		buffer(function(lpTextBuffer) {
			_customStatus = pStatusText;
			AkelPad.MemCopy(lpTextBuffer, pStatusText, _TSTR);
			AkelPad.SendMessage(hWndStatus, _TSTR ? 1035 /*SB_SETTEXTW*/ : 1025 /*SB_SETTEXTA*/, nParts - 1, lpTextBuffer);
		});
	};
	this.save = function() {
		_origStatus = this.get();
	};
	this.restore = function() {
		if(_origStatus && this.get() == _customStatus)
			this.set(_origStatus);
	};
}