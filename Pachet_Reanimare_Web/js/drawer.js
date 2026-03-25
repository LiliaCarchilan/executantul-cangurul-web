/**
 * @license
 * Copyright 2021 Константин Поляков
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Чертёжник-Blockly, основной файл, описывающий поведение Чертёжника
 * @author Project contributors
 */

//======================= GLOBALS =======================

var robotInterpreter = null;
var workspace = {};
var programCode = [];
var firstStep = true;
var legacyProgramSource = '';
var legacyProgramCode = '';
var legacyProgramFileName = '';
var activeProgramMode = 'blockly';

var fileName = '';

var Level = 1;
var freeMode = false;

var LevelVariant = 1;
var runFromVariant = -1;
var MAXVARIANTS = 1;

var LevelsDone = 0;
var LevelsTouched = 0;
var LevelsDoneKey;
var LevelsTouchedKey;

var LevelProgramKey;

var LevelSolutionRating = -1; // нет решения
var LevelSolutionRatingKey;

var allRatings = [0];

var AnimationDelayKey;
var MAXLEVEL = 10;
var map;
var baseMap;

var MAZE_WIDTH = 400;
var MAZE_HEIGHT = 400;
var DEFAULT_STAGE_MARGIN = 30;
var WORKSPACE_COLS = 40;
var WORKSPACE_ROWS = 40;
var xAxisShift = DEFAULT_STAGE_MARGIN; 
var yAxisShift = DEFAULT_STAGE_MARGIN; 

var startPos = { 'x': 0, 'y': 0, 'show': false, 'pen': false };
var robotPos = { 'x': 0, 'y': 0, 'show': false, 'pen': false };
var virtualPos = { 'x': 0, 'y': 0, 'show': false, 'pen': false };

var startDirection = 0;
var robotDirection = 0;
var virtualDirection = 0;
var unitSize = 20;

var robotMoveCount = 0;
var lineSegments = {};
var virtualLineSegments = {};

var ctxGrid;
var ctxScratch;
var ctxAnswer;
var ctxDisplay;
var robotColour;

var sliderScale = 250;
var animationDelay = 10;

var drawerImageFile  = './Media/drawer.png';
var drawerImageFile0 = './Media/drawer.png';
var drawerImage = new Image();

var checkPictureModes = { ALPHA: 0, EXACT: 1 };
var checkPictureMode = checkPictureModes.EXACT;

var runTypes = { NONE: -1, RUN: 0, STEP: 1 };
var runType = runTypes.NONE;

//======================= SHOW HELP =======================
function showHelp( header = "Ajutor" ) {
	var content = HelpContent[ Level ];
	if( content.length  && !(LevelsDone & (1 << (Level-1))) )
	  Blockly.alert( header, content, { top: '3em' } );
}

//======================= INIT APPLICATION =======================
function initApplication() { // widthProgram, heightProgram ) {
  var header = document.querySelector("title").innerHTML;	
  MAXLEVEL = Maps.length - 1; // Level 0 not used
  freeMode = (MAXLEVEL == 1) && (Maps[0].mode == 'free' );
  Level = getLevel();
  document.write( robotHTML( header ) ); //, widthProgram, heightProgram) ); 
  document.write( BlocklyBlocks(Level) );
  initRobot();
  window.addEventListener( "beforeunload", 
    function( e ) {
      if( workspace.getAllBlocks().length > 1 )        
        saveProgramToSessionStorage( false );
      return true; }
    );
}

function getParameterByName( name, url, defaultValue = '' ) {
  if( ! url ) url = window.location.search;
  var val = url.match(new RegExp('[?&]' + name + '=([^&]+)'));
  return val ? decodeURIComponent(val[1].replace(/\+/g, '%20')) : defaultValue;
}

function getLevel() {
  var thisLevel = parseInt( getParameterByName( 'level', null, '1' ) );
  if( thisLevel < 1  ||  thisLevel > MAXLEVEL) 
  	thisLevel = 1;
  return thisLevel;  
}

//======================= INIT ROBOT =======================
var editor;
var blocklyArea;
var blocklyDiv;
var uiLayout = {
  stageScale: 1,
  blocklyMinHeight: 460,
  editorHeight: 400,
  focus: 'all'
};

function clampValue( value, minValue, maxValue ) {
  return Math.min( Math.max( value, minValue ), maxValue );
}

function roundToStep( value, step ) {
  return Math.round( value / step ) * step;
}

function adjustBlocklyArea() {
  var rect = workspace.getBlocksBoundingBox();
  var height = rect.bottom - rect.top;
  blocklyArea.style.height = Math.max( height + 20, uiLayout.blocklyMinHeight ) + 'px';
  onResize();
}

function onResize(e) {
  // Compute the absolute coordinates and dimensions of blocklyArea.
  var element = blocklyArea;
  var x = 0;
  var y = 0;
  do {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  } while( element );
  // Position blocklyDiv over blocklyArea.
  blocklyDiv.style.left = x + 'px';
  blocklyDiv.style.top = y + 'px';
  blocklyDiv.style.width = blocklyArea.offsetWidth + 'px';
  blocklyDiv.style.height = blocklyArea.offsetHeight + 'px';
  Blockly.svgResize( workspace );
};

function injectBlockly() {

  blocklyArea = document.getElementById('blocklyArea');
  blocklyDiv = document.getElementById('blocklyDiv');

  var totalBlockLimit = BlockLimit[Level];
  if( typeof totalBlockLimit == 'object' ) {
  	totalBlockLimit = Math.max.apply(null, totalBlockLimit);
  	if( [Infinity, -Infinity].includes(totalBlockLimit) ) 
  	  totalBlockLimit = Infinity; 	 
    }

  if( typeof someBlocksLimit == 'object' ) 
       someBlocksLimit = someBlocksLimit[Level];
  else someBlocksLimit = {};

  workspace = Blockly.inject( blocklyDiv,
    { 
    media: './Media/', 
    trashcan: true, 
    maxBlocks: totalBlockLimit + 1,  // +1 на блок Программа
    maxInstances: someBlocksLimit,
    move: {drag: false, scrollbars: false, wheel: false},
    toolbox: document.getElementById('toolbox') 
    } );

  workspace.addChangeListener( adjustBlocklyArea );
  window.addEventListener( 'resize', onResize, false );
  // onResize();
  setTimeout( onResize, 500 );
  // Blockly.svgResize( workspace );
}

function initRobot() {

  drawerImage.src = drawerImageFile;
  drawerImage.onload = function() { display() };

  fileName = window.location.pathname.replace(/^.*[\\\/]/g, '');

  LevelsDoneKey = fileName + '_robotLevelsDone';  
  LevelsTouchedKey = fileName + '_robotLevelsTouched';  
  LevelProgramKey = fileName + '_' + Level;
  LevelSolutionRatingKey = fileName + '_rating_' + Level;
  AnimationDelayKey = fileName + '_animationDelay';

  (new Image()).src = './Media/big-star.gif';

  injectBlockly();
  setCustomColors();

  if( typeof initThisApplication == 'function' )
  	initThisApplication();

  freshRemainingBlocks();
  workspace.addChangeListener( function() { 
    if( activeProgramMode == 'legacy' && workspace.getAllBlocks().length > 0 )
      clearLegacyProgram();
    var runButton = document.getElementById('runButton');
    if( runButton.style.display == "none" )  
      reset();
   	  loadCodeToEditor();
	  freshRemainingBlocks();
	  } );

  editor = ace.edit("editor");
  editor.setTheme("ace/theme/xcode");
  editor.session.setMode("ace/mode/python");
  editor.session.setUseWorker(false);  // disable syntax check
  editor.setReadOnly(true);
  applyUserLayout();

  drawMap();

  loadProgramFromSessionStorage();  

  loadLevelsDone();
  loadAllRatings();

  initializeSlider( sliderChangedCallback );

  showHelp();
}

//======================= SET CUSTOM COLORS =======================
function setCustomColors() {
  var blockStyles = {
   "main_block": {
      "colourPrimary": "#47878a",
      "colourSecondary": "#4c9297",
      "colourTertiary": "#356063"
      },
   };
  var robotTheme = Blockly.Theme.defineTheme( 'robot_theme', 
    {
    'base': Blockly.Themes.Classic,
    'blockStyles': blockStyles,
    //'startHats': true
    });
  workspace.setTheme( robotTheme );
}

//======================= FRESH REMAINING BLOCKS =======================
function textRemainingBlocks( remains ) {
  return remains + (remains === 1 ? ' bloc' : ' blocuri');
}
function freshRemainingBlocks() {
  var remains = workspace.remainingCapacity();
  if( remains == Infinity) 
    document.getElementById('blockCount').style.display = "none";          
  else 
    document.getElementById('capacity').textContent = textRemainingBlocks(remains);          
}

//======================= LOAD USER XML PROGRAM =======================
function loadUserXMLProgram( xml_text ) {
	if( xml_text == null ) return;

	if( xml_text.trim() == '' )
	  Blockly.promptMultiline( "Introdu programul în format XML",
	  	 '', loadUserXMLProgram, "Program:", {} );
	else {
      try {
        var xml = Blockly.Xml.textToDom( xml_text );
        clearLegacyProgram();
        workspace.clear();
        Blockly.Xml.domToWorkspace( xml, workspace );
      }
      catch( err ) {
        Blockly.alert( "XML invalid",
          "Programul nu a putut fi încărcat. Verifică formatul XML și încearcă din nou." );
      }
	  }
}

function setLegacyProgram( sourceText, sourceFileName ) {
  var result;
  try {
    result = transpileCng( sourceText );
  }
  catch( err ) {
    var message = err && err.message ? err.message : 'Programul nu a putut fi interpretat.';
    if( typeof err.lineNumber == 'number' && err.lineNumber > 0 )
      message += ' Linia ' + err.lineNumber + '.';
    Blockly.alert( 'Fișier .cng invalid', message );
    return false;
  }

  legacyProgramSource = String(sourceText || '');
  legacyProgramCode = result.code;
  legacyProgramFileName = sourceFileName || 'program.cng';
  activeProgramMode = 'legacy';
  workspace.clear();
  var selectLang = document.getElementById("lang");
  if( selectLang ) selectLang.value = 'cng';
  loadCodeToEditor( selectLang );
  return true;
}

function clearLegacyProgram() {
  legacyProgramSource = '';
  legacyProgramCode = '';
  legacyProgramFileName = '';
  activeProgramMode = 'blockly';
  var selectLang = document.getElementById("lang");
  if( selectLang && selectLang.value == 'cng' ) selectLang.value = 'py';
}

//======================= STRIP CODE =======================
function stripCode( code ) {
  code = code.replace(/(\('[^']{10,}'\))/gm, '()'); // only block id
  code = code.replace(/(\('[^']+',[ ]*)/g, '(');  // block id and params after it
  code = code.replace(/_/g, '%');
  code = code.replace(/%%/g, '_%');
  try { code = decodeURIComponent(code); } catch (err) { }
  return code;
}

//======================= SLIDER =======================
function sliderChangedCallback( sliderValue ) {
  animationDelay = Math.round( sliderScale * Math.exp(-3.2188*sliderValue) );
  if( ! window.sessionStorage ) { return; }  
  window.sessionStorage[AnimationDelayKey] = animationDelay.toString(); 
}

//======================= LOAD CODE TO EDITOR =======================
function loadCodeToEditor( selectLang = null ) {
  Blockly.JavaScript.INFINITE_LOOP_TRAP = null;
  var code;
  if( ! selectLang ) 
    selectLang = document.getElementById("lang");
  var langValue = selectLang.value;
  if( activeProgramMode == 'legacy' ) {
    if( langValue == 'cng' ) {
      code = legacyProgramSource;
      editor.session.setMode("ace/mode/text");
      editor.getSession().setUseWrapMode(true);
    }
    else {
      code = legacyProgramCode;
      editor.session.setMode("ace/mode/javascript");
      editor.getSession().setUseWrapMode(false);
      code = stripCode( code );
    }
    editor.setValue( code, 1 );
    return;
  }
  if( langValue == "py" ) {
    code = Blockly.Python.workspaceToCode( workspace );
    editor.session.setMode("ace/mode/python");
    }
  else if( langValue == "cng" ) {
    code = '// Vizualizarea CNG este disponibilă după încărcarea unui fișier .cng.';
    editor.session.setMode("ace/mode/text");
    }
  else if( langValue == "php" ) {
    code = Blockly.PHP.workspaceToCode( workspace );
    editor.session.setMode("ace/mode/php");
    }
  else if( langValue == "dart" ) {
    code = Blockly.Dart.workspaceToCode( workspace );
    editor.session.setMode("ace/mode/dart");
    }
  else if( langValue == "lua" ) {
    code = Blockly.Lua.workspaceToCode( workspace );
    editor.session.setMode("ace/mode/lua");
    }
  else if( langValue == "xml" ) {
    code = getXMLCode();
    editor.session.setMode("ace/mode/xml");
    }
  else {
    code = Blockly.JavaScript.workspaceToCode( workspace );
    editor.session.setMode("ace/mode/javascript");
    }
  if( langValue == "xml" || langValue == "cng" ) 
    editor.getSession().setUseWrapMode(true);
  else {
    editor.getSession().setUseWrapMode(false);
    code = stripCode( code );
    }
  editor.setValue( code, 1 );
}

//======================= LOAD PROGRAM FROM DISK =======================
function loadProgramFromDisk() {
  var file = document.getElementById('file-load').files[0];
  if( !file ) { return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    var content = e.target.result;
    if( /\.cng$/i.test(file.name) ) {
      setLegacyProgram( content, file.name );
      return;
    }
    loadUserXMLProgram( content );
    };
  reader.readAsText(file);
}

//======================= SAVE PROGRAM TO DISK =======================
function doSaveFile( fileName ) {
  if( fileName == null ) return;
  var textToWrite = activeProgramMode == 'legacy' ? legacyProgramSource : getXMLCode();
  var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
  if ( fileName.trim() == '' ) 
    fileName = activeProgramMode == 'legacy' ? 'program.cng' : 'program';
  if ( fileName.indexOf('.') < 0 ) 
    fileName += activeProgramMode == 'legacy' ? '.cng' : '.xml';
  var downloadLink = document.createElement("a");
  downloadLink.download = fileName;
  downloadLink.innerHTML = "Descarcă fișierul";
  if ( window.webkitURL != null )  // Chrome allows the link to be clicked without actually adding it to the DOM.
    downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
  else { // Firefox requires the link to be added to the DOM before it can be clicked.
    downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
    downloadLink.onclick = destroyClickedElement;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    }
  downloadLink.click();
}

function destroyClickedElement(event)
{
  document.body.removeChild(event.target);
}

function saveProgramToDisk()
{
	Blockly.prompt( "Salvare fișier", legacyProgramFileName, doSaveFile, "Introdu numele fișierului", {} );
}

//======================= RUN CODE =======================
var runtimeError;
function runCode( isStepwise = false ) {

  var remains = workspace.remainingCapacity();
  if( remains < 0 ) {
    Blockly.alert( "Executarea a fost oprită",
      "Eroare: programul folosește prea multe blocuri. Pentru a continua, elimină " +
      textRemainingBlocks(-remains) + "." );
    return; 
    }

  if( runType == runTypes.NONE ) {
  	runFromVariant = LevelVariant;
    if( isStepwise ) 
    	 runType = runTypes.STEP;
    else {
    	runType = runTypes.RUN;
    	var primary = false; 
    	drawMap( primary, 0 );
        }
    }  

  var runButton = document.getElementById('runButton');
  var resetButton = document.getElementById('resetButton');
  var stepButton = document.getElementById('stepButton');
  if( isStepwise ) {
    runButton.style.display = 'inline';
    runButton.style.display = 'none';
    resetButton.style.display = 'inline';
    }
  else {
    runButton.style.display = 'none';
    stepButton.style.display = 'none';
    resetButton.style.display = 'inline';
    }

  if( programCode.length > 0 ) {   
    animateProgram( isStepwise );
    return;
    }

  // Не подсвечивать блоки при трансляции
  //Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
  //Blockly.JavaScript.addReservedWords( 'highlightBlock' );

  var code;
  //if( blockId ) { // Getting code for a specific block
  //  var block = workspace.getBlockById( blockId );
  //  code = Blockly.JavaScript.blockToCode( block ); 
  //  } 
  //else {
    if( activeProgramMode == 'legacy' ) 
      code = legacyProgramCode;
    else
      code = Blockly.JavaScript.workspaceToCode( workspace );
  //  }

  Blockly.JavaScript.INFINITE_LOOP_TRAP = null;
  robotInterpreter = new Interpreter( code, initRobotApi );

  virtualPos = { 'x': robotPos['x'], 'y': robotPos['y'], 'show': false, 'pen': false };
  virtualDirection = robotDirection;
  virtualLineSegments = {};
  
  programCode = [];
  firstStep = true;
  runtimeError = '';
  robotMoveCount = 0;
  robotSensorCount = 0;

  saveProgramToSessionStorage();

  stepCode( isStepwise );
  }

//======================= STEP CODE =======================
var timeToWait = 0;
var MAXPROGLENGTH = 10000;
var MAXSTEADYCOUNT = 100;
function stepCode( isStepwise = false ) {

  var prevProgLen = programCode.length; 
  var steadyStateCount = 0;
  while( robotInterpreter.step() && !runtimeError.length ) {
    if( prevProgLen == programCode.length ) 
      steadyStateCount += 1; 
    else {
      prevProgLen = programCode.length;
      steadyStateCount = 0; 
      }
    if( programCode.length > MAXPROGLENGTH  ||  steadyStateCount >= MAXSTEADYCOUNT ) {
  	  runtimeError = 'Programul a fost oprit: există prea multe operații. Este posibilă o buclă infinită.';
      programCode.push( [ null, 'cycle' ] );	
      } 
    }

  if( runtimeError.length ) 
    console.log( runtimeError );
  else {
    console.log( 'OK.' );
    programCode.push( [ null, 'finish' ] );	
    }
  
  animateProgram( isStepwise );

  return;	
}

function addStepPause( blockId ) {
  if( ! firstStep ) 
    programCode.push( [ blockId, 'stepReady' ] );
  else
    firstStep = false;
}

//======================= RESET =======================
function restoreField() {

  robotDirection = startDirection;
  robotPos = { 'x': startPos['x'], 'y': startPos['y'], 
               'show': startPos['show'], 'pen': startPos['pen'],
                'width': startPos['width'] };
  robotColour = "#000000";
  lineSegments = {};

  //ctxScratch.canvas.width = ctxScratch.canvas.width;
  ctxScratch.setTransform(1, 0, 0, 1, 0, 0);
  ctxScratch.clearRect( 0, 0, ctxScratch.canvas.width, ctxScratch.canvas.height );

  ctxScratch.strokeStyle = robotColour;
  ctxScratch.fillStyle = '#ffffff';
  ctxScratch.lineWidth = startPos['width'];
  //ctxScratch.lineCap = 'round';
  ctxScratch.font = 'normal 18pt Arial';

  //robotPos['pen'] = false;
  //doDrawerMove( robotPos['x'], robotPos['y'] );
  //robotPos['pen'] = startPos['pen'];
    
  display();

}

function reset() {

  runtimeError = 'Executarea a fost oprită de utilizator.';

  workspace.highlightBlock( null );

  var runButton = document.getElementById('runButton');
  runButton.style.display = 'inline';
  var stepButton = document.getElementById('stepButton');
  stepButton.style.display = 'inline';
  var resetButton = document.getElementById('resetButton');
  resetButton.style.display = 'none';

  programCode = [];
  robotMoveCount = 0;
  robotSensorCount = 0;
  freshOperationCounters();

  restoreField();

  runType = runTypes.NONE;
  runFromVariant = -1;

}

function showResetButton() {
  var runButton = document.getElementById('runButton');
  runButton.style.display = 'none';
  var stepButton = document.getElementById('stepButton');
  stepButton.style.display = 'none';
  var resetButton = document.getElementById('resetButton');
  resetButton.style.display = 'inline';
}

//======================= PROGRAM ANIMATION =======================
function freshOperationCounters() {
   var counters = document.getElementById('counters');
   if( robotMoveCount == 0 )
     counters.innerHTML = '';
   else
   	 counters.innerHTML = 'Operații executate: ' + Math.floor(robotMoveCount);
}

function animateProgram( isStepwise  = false ) {
    var stepPaused = false;
    
    var nextDelay = animationDelay;
    if( isStepwise ) nextDelay = 0;

	if( programCode.length > 0 ) {
      var operation = programCode.shift();
  	  var blockId = operation[0];
      var command = operation[1];
      var param = operation[2];
      highlightBlock( blockId );

      if( command == 'show' ) {
	  	  doDrawerShow( param );
        robotMoveCount += 1;
        }
      else if( command == 'pen' ) {
        doDrawerPen( param );
        robotMoveCount += 1;
     	}
      else if( command == 'move' ) {
        var param2 = operation[3];
        doDrawerMove( param, param2 );
        robotMoveCount += 1;
        }
      else if( command == 'moveRel' ) {
        var param2 = operation[3];
        doDrawerMoveRel( param, param2 );
        robotMoveCount += 1;
        }
      else if( command == 'forward' ) {
        doDrawerForward( param );
        robotMoveCount += 1;
        }
      else if( command == 'jump' ) {
        doDrawerJump( param );
        robotMoveCount += 1;
        }
      else if( command == 'turn' ) {
        doDrawerTurn( param );
        robotMoveCount += 1;
        }
      else if( command == 'colour' ) {
        doPenColour( param );
        robotMoveCount += 1;
        }
      else if( command == 'fill' ) {
        doDrawerFill( param );
        robotMoveCount += 1;
        }
      else if( ['crash','cycle'].includes(command) ) {
        Blockly.alert( 'Eroare la executarea programului',
        	           runtimeError, { top: '10em' } );
        showResetButton();
        }
      else if( command == 'finish' ) {
        checkSolution();
        showResetButton();
        }  
      else if( command == 'stepReady' ) {
        if( programCode[0][1] == 'finish' ) // next command
          isStepwise = false;
        if( isStepwise ) 
          stepPaused = true;
        }  
	  }
	freshOperationCounters();  
	if( ! stepPaused && programCode.length > 0 ) 
	  setTimeout(  function() { animateProgram( isStepwise ); }, nextDelay );
}

//======================= GET-SET LEVELS DONE TOUCHED =======================
function saveLevelsDone() {
  // MSIE 11 does not support sessionStorage (or localStorage) on file:// URLs.
  if( typeof Blockly == undefined || ! window.sessionStorage ) { return; }  
  var text = LevelsDone.toString();
  window.sessionStorage[LevelsDoneKey] = text;
}

function loadLevelsDone()  {

  if( freeMode ) return 0;

  try {   	
    if( window.sessionStorage ) {
  	  LevelsDone = window.sessionStorage[LevelsDoneKey] || 0;
      LevelsTouched = window.sessionStorage[LevelsTouchedKey] || 0;
      LevelSolutionRating = window.sessionStorage[LevelSolutionRatingKey] || -1;
      }
    } 
  catch (e) {
    // Firefox sometimes throws a SecurityError when accessing localStorage.
    // Restarting Firefox fixes this, so it looks like a bug.
    LevelsDone = 0;
    LevelsTouched = 0;
    LevelSolutionRating = -1;
    }
  LevelsDone = parseInt(LevelsDone);
  LevelsTouched = parseInt(LevelsTouched);
  LevelSolutionRating = parseInt(LevelSolutionRating);

  var levelMenu = document.getElementById("levelMenu");
  for( var i=1; i<=MAXLEVEL; i++ ) { 
  	var Level_i_Rating = loadSolutionRating( i );
  	var doneClass = ratingClass(Level_i_Rating);
    if( i == Level ) {
      var span = document.createElement('span');
      span.className = "level_number";
      if( LevelsDone & (1 << (i-1)) ) 
        span.className += " " + doneClass;        
      else
        span.className += " level_fill";
	  span.id = "level" + i;
	  span.innerHTML = i.toString();
	  levelMenu.appendChild( span );
      }
    else if( i == MAXLEVEL ) {
      var link = document.createElement('a');
	  link.className = "level_number";
      if( LevelsDone & (1 << (i-1)) ) 
        link.className += ' ' + doneClass;        
      else if( LevelsTouched & (1 << (i-1)) ) 
        link.className += ' level_fill';        
	  link.id = "level" + i;
	  link.href = "?level=" + i;
	  link.innerHTML = i.toString();
	  levelMenu.appendChild( link );
      }
    else {
      var link = document.createElement('a');
	  link.className = "level_dot";
      if( LevelsDone & (1 << (i-1)) ) 
        link.className += " " + doneClass;
      else if( LevelsTouched & (1 << (i-1)) ) 
        link.className += ' level_fill';        
	  link.id = "level" + i;
	  link.href = "?level=" + i;
	  levelMenu.appendChild( link );
      }
    levelMenu.appendChild( document.createTextNode(" ") );
    }
  return parseInt(LevelsDone);
};

//======================= RATING CLASS =======================
function ratingClass( rating ) {
  switch( rating ) {
    case 5: return "level_best "; break;	
   	case 4: return "level_medium "; break;	
    case 1: case 2: case 3: return "level_done ";        
    default: return "";        
    }
}

//======================= CALCULATE SOLUTION RATING  =======================
function calculateSolutionRating() {
  LevelSolutionRating = 5;  
  if( typeof BlockLimit == "undefined" ) 
  	return;
  var grid = BlockLimit[Level];
  if( typeof grid == "undefined" ) 
  	return;
  if( typeof grid != "object" )
  	grid = [grid];
  var numberOfBlocks = workspace.getAllBlocks().length;
  for( var i=0; i < grid.length; i++ ) {
    if( numberOfBlocks <= grid[i] + 1 ) break;
    LevelSolutionRating -= 1;
    }  
}

//======================= LOAD SOLUTION RATING  =======================
function loadSolutionRating( someLevel )  { 
  var someLevelSolutionRatingKey = fileName + '_rating_' + someLevel;
  var someLevelRating = 0;
  try {   	
    if( window.sessionStorage ) 
      someLevelRating = window.sessionStorage[someLevelSolutionRatingKey] || 0;
    } 
  catch (e) { someLevelRating = 0; }
  return parseInt(someLevelRating);
}

//======================= LOAD ALL RATINGS  =======================
function loadAllRatings() {
  var totalRatings = 0;	
  for( var i=1; i <= MAXLEVEL; i++ ) {
    var Level_i_Rating = loadSolutionRating( i );
    allRatings.push( Level_i_Rating );
    totalRatings += Level_i_Rating;
    }
  if( totalRatings > 0 ) {
    document.getElementById("starDiv").style.display = "inline";
    document.getElementById("totalStars").innerHTML = totalRatings.toString();
    }
}

//======================= FRESH TOTAL RATING  =======================
function freshTotalRating() {
  var totalRatings = 0;	
  allRatings[Level] = LevelSolutionRating;
  for( var i=1; i <= MAXLEVEL; i++ ) 
  	if( allRatings[i] > 0)  
      totalRatings += allRatings[i];
  if( totalRatings > 0 ) {
    document.getElementById("starDiv").style.display = "inline";
    document.getElementById("totalStars").innerHTML = totalRatings.toString();
    }
}

//======================= MULTI MAP TEXT  =======================
function multiMapText() {
	return '' + (LevelVariant+1) + ' din ' + MAXVARIANTS;
}

//======================= SHOW MULTI MAP  =======================
function showMultiMap() {
  var rating = document.getElementById("rating");	
  var multi = document.getElementById("multimap");	
  if( rating.style.display == "none" &&
      MAXVARIANTS > 1 ) {
  	multi.style.display = "inline";
  	var countSpan = document.getElementById("mapcount");
  	countSpan.innerHTML = multiMapText();
    }
  else
  	multi.style.display = "none";
}

//======================= SHOW RATING  =======================
function showRating() {
  var rating = document.getElementById("rating");	
  if( ! rating ) return;
  if( LevelSolutionRating < 0 ) {
    rating.style.display = "none";
    if( MAXVARIANTS > 1 ) showMultiMap();
	return;
	}
  rating.style.display = "inline";
  showMultiMap();
  for( var i=1; i<=5; i++ ) {
    var star = document.getElementById('star'+i);
    if( star ) {
      star.src = "./Media/star.gif";
      star.style.opacity = i <= LevelSolutionRating ? '1' : '0.2';
    }
    }
}

//======================= USE SESSION STORAGE =======================
function saveProgramToSessionStorage( touched = true ) {
  // MSIE 11 does not support sessionStorage (or localStorage) on file:// URLs.
  if( typeof Blockly == undefined || ! window.sessionStorage ) { return; }  

  var xml_text = getXMLCode();
  window.sessionStorage[LevelProgramKey] = xml_text;

  if( touched ) {
    LevelsTouched |= 1 << (Level-1);
    var text = LevelsTouched.toString();
    window.sessionStorage[LevelsTouchedKey] = text;
  }
}

function saveSolutionRating() {
  if( LevelSolutionRating > 0)	
    window.sessionStorage[LevelSolutionRatingKey] = LevelSolutionRating.toString();
}

function loadProgramFromSessionStorage()  {
  var xml_text;	
  try { 
  	xml_text = window.sessionStorage[LevelProgramKey]; 
    } 
  catch (e) {
    // Firefox sometimes throws a SecurityError when accessing localStorage.
    // Restarting Firefox fixes this, so it looks like a bug.
    }

  if( typeof xml_text == 'undefined' ) { 
    if( typeof ReadyProgram == 'object' ) 
      xml_text = ReadyProgram[Level];
    if( typeof xml_text == 'undefined'  ||  xml_text.trim() == '' )
      xml_text = '<xml><block type="drawer_program" deletable="false" movable="false"></block></xml>';
    }
  else {
    if( xml_text.indexOf('drawer_program') < 0 ) {
      xml_text = xml_text.replace( 'xml">' , 'xml">' + 
	        '<block type="drawer_program" deletable="false" movable="false"><next>' );
	  xml_text = xml_text.replace( '</xml>' , '</next></block></xml>' );
      }
    try { 
      LevelSolutionRating = window.sessionStorage[LevelSolutionRatingKey];       
      } 
    catch (e) {
      // Firefox sometimes throws a SecurityError when accessing localStorage.
      // Restarting Firefox fixes this, so it looks like a bug.
      LevelSolutionRating = -1;
      }  
    }
  LevelSolutionRating = LevelSolutionRating || -1;   

  var xml = Blockly.Xml.textToDom( xml_text );
  Blockly.Xml.domToWorkspace( xml, workspace );    
  
  freshRemainingBlocks();
  
  workspace.addChangeListener( Blockly.Events.disableOrphans );

  showRating();

  return true;
};

function getXMLCode() {
  var xml = Blockly.Xml.workspaceToDom( workspace, true );
  // Remove x/y coordinates from XML if there's only one block stack.
  // There's no reason to store this, removing it helps with anonymity.
  if ( workspace.getTopBlocks(false).length == 1 && xml.querySelector) {
    var block = xml.querySelector('block');
    if( block ) {
      block.removeAttribute('x');
      block.removeAttribute('y');
      }
    }
  var xml_text = Blockly.Xml.domToText(xml);
  return xml_text;
}

//======================= NEXT LEVEL =======================
function nextLevel( agree ) {
	if( agree && Level < MAXLEVEL ) {
       window.location = window.location.protocol + '//' +
        window.location.host + window.location.pathname +
        '?level=' + (Level + 1);
	  }
}

//======================= ADD/REMOVE CLASS =======================
function addClass( ID, className ) {
  var element = document.getElementById( ID );
  classList = element.className.split(" ");
  if( classList.indexOf(className) == -1 ) 
    element.className += " " + className;
}
function removeClass( ID, className ) {
  var element = document.getElementById( ID );
  var replaceRegex = "\b" + className + "\b";
  var re = new RegExp( replaceRegex, "g" );
  element.className = element.className.replace( re, "" );
}

//======================= FIX SOLUTION RESULTS =======================
function fixSolutionResults( levelDone ) {

  if( levelDone ) {
    LevelsDone |= 1 << (Level - 1);   	
    calculateSolutionRating();
    }
  else {	  	
    LevelsDone &= ~(1 << (Level - 1));   	
    LevelSolutionRating = -1;	
    }  

  var id = "level" + Level;
  document.getElementById( id ).className = "level_number " + ratingClass(LevelSolutionRating); 

  saveLevelsDone();    
  saveSolutionRating();
  showRating(); 
  freshTotalRating();
}


//======================= CHECK SOLUTION =======================
function pixelsDiffName( n ) {
  return n === 1 ? 'difera 1 pixel' : 'difera ' + n + ' pixeli';
}

function hue( r, g, b ) {
  r = r / 255.; 
  g = g / 255.; 
  b = b / 255.; 
  var cmax = Math.max( r, g, b );
  var cmin = Math.min( r, g, b );
  var diff = cmax - cmin;
  var h = 0;
  if( diff == 0 ) h = 0;
  else {
    if( cmax == r ) h = Math.round(60 * ((g - b) / diff) + 360) % 360;
    if( cmax == g ) h = Math.round(60 * ((b - r) / diff) + 120) % 360; 
    if( cmax == b ) h = Math.round(60 * ((r - g) / diff) + 240) % 360; 
    }
  return h;
}

function hueDiff( r1, g1, b1, r2, g2, b2 ) {
  var h1 = hue( r1, g1, b1 );
  var h2 = hue( r2, g2, b2 );
  return Math.abs( h1 - h2 );
}

function colorDiff( r1, g1, b1, a1, r2, g2, b2, a2 ) {
// CIE Delta E 2000 Color-Difference algorithm (CIEDE2000)   
// Realization: https://hamada147.github.io/IsThisColourSimilar/
  const [L1, A1, B1] = Colour.rgba2lab(r1, g1, b1, a1);
  const [L2, A2, B2] = Colour.rgba2lab(r2, g2, b2, a2);
  const delta = Colour.deltaE00(L1, A1, B1, L2, A2, B2);
  return delta;
}                    

function checkSolution() {

  var errorMessage = '';
  var result = true;

  if ( freeMode ) return result;

  var userImage = ctxScratch.getImageData( 0, 0, MAZE_WIDTH, MAZE_HEIGHT );
  var answerImage = ctxAnswer.getImageData( 0, 0, MAZE_WIDTH, MAZE_HEIGHT );
  var len = Math.min( userImage.data.length, answerImage.data.length );
  var delta = 0;
  var answerNonEmpty = 0;

  if( checkPictureMode == checkPictureModes.EXACT ) {
    for( var i = 0; i < len; i += 4 ) {
      if( answerImage.data[i+3] > 0 ) answerNonEmpty ++;

      r = userImage.data[i];
      g = userImage.data[i+1];
      b = userImage.data[i+2];
      a = userImage.data[i+3];
      rAnswer = answerImage.data[i];
      gAnswer = answerImage.data[i+1];
      bAnswer = answerImage.data[i+2];
      aAnswer = answerImage.data[i+3];

      var tolColor = 40;
      diff = colorDiff( r, g, b, a, rAnswer, gAnswer, bAnswer, aAnswer );
      if ( aAnswer > 0 && a == 0  ||  aAnswer == 0 && a > 0  )
        delta += 1;
      else if( diff > tolColor ) {
        delta += (a + aAnswer) / 2 / 256;
      }
    }
  }
  else {
    for( var i = 3; i < len; i += 4 ) {
      if( answerImage.data[i] > 0 ) answerNonEmpty ++;
      relDiff = Math.abs(userImage.data[i] - answerImage.data[i]) / 256.;
      if ( relDiff > 0.5 ) delta += relDiff;
    }
  }
  delta = Math.round(delta);

  var errorLimit = parseInt( 0.02*answerNonEmpty );
  if( typeof(DiffLimit) == "object" )
    if( typeof(DiffLimit[Level]) == "number" )
      errorLimit = DiffLimit[Level];

  if( delta > errorLimit )
    errorMessage = ' Desenul nu corespunde modelului (' + pixelsDiffName(delta) + '). ';

  if( errorMessage.length ) {
    errorMessage = '<div class="error">' + errorMessage + '</div>';
    Blockly.alert( "Rezolvare incompleta",
      "Sarcina nu este inca rezolvata." + errorMessage + ' Incearca din nou.', { top: '10em' } );

    fixSolutionResults( false );
    result = false;
  }
  else {
    fixSolutionResults( true );

    var greetings = "Felicitari!";
    var message = "Sarcina a fost rezolvata complet! ";
    if( LevelSolutionRating == 5 )
      message += 'Solutia este excelenta si primeste 5 <img src="./Media/star.gif" class="star">.';
    else if( LevelSolutionRating == 4 )
      message += 'Solutia este buna si primeste 4 <img src="./Media/star.gif" class="star">. Se poate obtine un rezultat si mai compact.';
    else
      message += 'Sarcina a fost rezolvata, dar solutia foloseste prea multe blocuri.';

    if( Level == MAXLEVEL ) {
      message += " Ai terminat ultimul nivel.";
      Blockly.alert( greetings,  message, { top: '10em' } );
    }
    else {
      message += " Vrei sa treci la nivelul urmator?";
      Blockly.confirm( greetings,  message,
           { top: '10em', okMessage: 'Da', cancelMessage: 'Nu'  }, nextLevel );
    }
  }

  return result;

}

//======================= TURTLE ANSWER FUNCTIONS =======================
function show() { doDrawerShow( true ); }
function hide() { doDrawerShow( false ); }
function penDown() { doDrawerPen( true ); }
function penUp() { doDrawerPen( false ); }
function toPoint( absX, absY ) { doDrawerMove( absX, absY ); }
function vector( deltaX, deltaY ) { doDrawerMoveRel( deltaX, deltaY ); }
function forward( steps ) { doDrawerForward( steps ); }
function turn( angle ) { doDrawerTurn( angle ); }
function jump( steps ) { doDrawerJump( steps ); }
function penColour( colour ) { doPenColour( colour ); }
function floodFill( colour ) { doDrawerFill( colour ); }
function floodFillNo( colourNo ) { 
  if( colourNo < 0 ) colourNo = - colourNo;
  colourNo = colourNo % 16;
  var colors = [ '#000000', '#003399', '#339933', '#009999', 
                 '#990033', '#990066', '#663300', '#cccccc',
                 '#999999', '#0066ff', '#66ff33', '#33ffff',
                 '#ff3333', '#cc0099', '#ffff33', '#ffffff'];
  doDrawerFill( colors[colourNo] ); 
}
function drawGrid( _xAxisShift, _yAxisShift, withAxes = true ) {
  xAxisShift = _xAxisShift; 
  yAxisShift = _yAxisShift;	
  var prevWidth = robotPos['width'];
  robotPos['width'] = 1;
  var x;
  var y;
  robotColour = withAxes ? '#ffe600' : '#ffe600';
  for( x = 0; x <= WORKSPACE_COLS; x += 1 ) {
    penUp();
    toPoint( x, 0 );
    penDown();
    toPoint( x, -WORKSPACE_ROWS );
    robotColour = '#ffe600';
  }
  robotColour = withAxes ? '#ffe600' : '#ffe600';
  for( y = 0; y >= -WORKSPACE_ROWS; y -= 1 ) {
    penUp();
    toPoint( 0, y );
    penDown();
    toPoint( WORKSPACE_COLS, y );
    robotColour = '#ffe600';
  }
  penUp();
  toPoint( startPos['x'], startPos['y'] );
  penDown();
  robotPos['width'] = prevWidth; 
  robotColour = "#000000";

  ctxGrid.globalCompositeOperation = 'copy';
  ctxGrid.drawImage( ctxScratch.canvas, 0, 0 );

  ctxScratch.clearRect( 0, 0, ctxScratch.canvas.width, ctxScratch.canvas.height );
  //robotPos['pen'] = false;
  doDrawerMove( robotPos['x'], robotPos['y'] );
  robotPos['pen'] = startPos['pen'];
  
}

function drawAnswer() {  
  Answers[Level]();
  doDrawerPen( startPos['pen'] );
  ctxAnswer.globalCompositeOperation = 'copy';
  ctxAnswer.drawImage( ctxScratch.canvas, 0, 0 );
  ctxAnswer.globalCompositeOperation = 'source-over';
}

//======================= TURTLE IMPLEMENTATION =======================
var isAnimating = false;

function display() {

  ctxDisplay.clearRect(0, 0, ctxDisplay.canvas.width, ctxDisplay.canvas.height);
  ctxDisplay.fillStyle = '#ffffff';
  ctxDisplay.fillRect(0, 0, ctxDisplay.canvas.width, ctxDisplay.canvas.height);

  var stageWidth = WORKSPACE_COLS * unitSize;
  var stageHeight = WORKSPACE_ROWS * unitSize;
  if( stageWidth > 0 && stageHeight > 0 ) {
    ctxDisplay.fillStyle = '#c7c7c7';
    ctxDisplay.fillRect( xAxisShift, yAxisShift, stageWidth, stageHeight );
  }

  // Draw the grid layer.
  ctxDisplay.globalCompositeOperation = 'source-over';
  ctxDisplay.globalAlpha = 0.4;
  ctxDisplay.drawImage( ctxGrid.canvas, 0, 0 );
  ctxDisplay.globalAlpha = 1;

  // Draw the answer layer.
  ctxDisplay.globalCompositeOperation = 'source-over';
  ctxDisplay.globalAlpha = 0.4;
  ctxDisplay.drawImage( ctxAnswer.canvas, 0, 0 );
  ctxDisplay.globalAlpha = 1;

  // Draw the user layer.
  ctxDisplay.globalCompositeOperation = 'source-over';
  ctxDisplay.drawImage( ctxScratch.canvas, 0, 0 );

  // Draw the turtle.
  if ( robotPos['show'] ) {
    var x = xAxisShift + robotPos['x']*unitSize;
    var y = yAxisShift - robotPos['y']*unitSize;

    ctxDisplay.save();
    ctxDisplay.translate( x, y );
    ctxDisplay.rotate( -robotDirection * Math.PI / 180 );
    ctxDisplay.drawImage( drawerImage, -drawerImage.width, -18 );
    ctxDisplay.restore();
    }

  refreshSensorPanel();
}

function doDrawerShow( state ) {
  robotPos['show'] = state;
  display(); 
}

function doDrawerPen( state ) {
  robotPos['pen'] = state;
  if( state )
       drawerImage.src = drawerImageFile;
  else drawerImage.src = drawerImageFile0;
}

function doPenColour( colour ) {
  robotColour = colour;
}

function getPixel( imageData, x, y ) {
  function dec2hex( d ) {
    return (d+0x100).toString(16).substr(-2);
  }
  var width = imageData.width;
  var point = y * 4 * width + x * 4;
  var r = '' + dec2hex(imageData.data[point]);
  var g = '' + dec2hex(imageData.data[point+1]);
  var b = '' + dec2hex(imageData.data[point+2]);
  var a = '' + dec2hex(imageData.data[point+3]);
  return r + g + b + a;
}

function canvasFloodFill( ctx, x0, y0, color ) {
    var imageData = ctx.getImageData( 0, 0, MAZE_WIDTH, MAZE_HEIGHT );
    var width = imageData.width;
    var height = imageData.height;
    var stack = [ [x0, y0] ];
    var color0 = getPixel( imageData, x0, y0 );
    if( color.substr(1)+"ff" == color0 ) return;
    var r = parseInt( color.substr(1,2), 16);
    var g = parseInt( color.substr(3,2), 16);
    var b = parseInt( color.substr(5,2), 16);
    while( stack.length > 0 ) {   
        var pixelPos = stack.pop();
        var x = pixelPos[0];
        var y = pixelPos[1];
        if( x < 0 || x >= width)  continue;
        if( y < 0 || y >= height) continue;
        if( getPixel( imageData, x, y ) == color0 ) {
            // Закрашиваем
          var point = y * 4 * width + x * 4;
          imageData.data[point] = r;            
          imageData.data[point+1] = g;            
          imageData.data[point+2] = b;            
          imageData.data[point+3] = 255;            
            // Ставим соседей в стек на проверку
          stack.push( [ x - 1, y ]);
          stack.push( [ x + 1, y ]);
          stack.push( [ x, y - 1 ]);
          stack.push( [ x, y + 1 ]);
          }
      }
    ctx.putImageData( imageData, 0, 0 );
}

function doDrawerFill( colour ) {
  canvasFloodFill( ctxScratch, 
             Math.round( robotPos['x']*unitSize+xAxisShift ), 
             Math.round( yAxisShift-robotPos['y']*unitSize ), colour );
  display();
}

function doDrawerMove( absX, absY ) {
  var oldX = robotPos['x'];
  var oldY = robotPos['y'];

  if( robotPos['pen'] ) {
    ctxScratch.beginPath();
    ctxScratch.moveTo( Math.round(oldX*unitSize+xAxisShift) + 0.5, 
                       Math.round(yAxisShift-oldY*unitSize) + 0.5 );
    }

  robotPos['x'] = absX;
  robotPos['y'] = absY;

  if( robotPos['pen'] ) {
    addSegment(lineSegments, oldX, oldY, absX, absY);
    ctxScratch.lineWidth = robotPos['width']; 
    ctxScratch.strokeStyle = robotColour;
    ctxScratch.lineTo( Math.round(robotPos['x']*unitSize+xAxisShift) + 0.5, 
                       Math.round(yAxisShift-robotPos['y']*unitSize) + 0.5 );
    ctxScratch.stroke();
    }

  display();
}

function doDrawerMoveRel( deltaX, deltaY ) {
  doDrawerMove( robotPos['x'] + deltaX,
                robotPos['y'] + deltaY );
}

function directionDelta( steps, direction ) {
  steps = Number(steps) || 0;
  direction = Number(direction) || 0;
  var radians = direction * Math.PI / 180;
  return {
    x: Math.cos(radians) * steps,
    y: Math.sin(radians) * steps
  };
}

function roundedCoord(value) {
  return Math.round(value * 1000) / 1000;
}

function segmentKey(x1, y1, x2, y2) {
  x1 = roundedCoord(x1);
  y1 = roundedCoord(y1);
  x2 = roundedCoord(x2);
  y2 = roundedCoord(y2);
  var first = x1 + ',' + y1;
  var second = x2 + ',' + y2;
  return first < second ? first + '|' + second : second + '|' + first;
}

function addSegment(storage, x1, y1, x2, y2) {
  storage[segmentKey(x1, y1, x2, y2)] = true;
}

function hasSegment(storage, x1, y1, x2, y2) {
  return storage[segmentKey(x1, y1, x2, y2)] === true;
}

function nextPosition(pos, direction, steps) {
  var delta = directionDelta(steps, direction);
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}

function checkBorderAheadForState(pos, direction, steps) {
  var next = nextPosition({x: pos.x, y: pos.y}, direction, steps);
  var px = Math.round(next.x * unitSize + xAxisShift);
  var py = Math.round(yAxisShift - next.y * unitSize);
  return px < xAxisShift ||
         px > xAxisShift + WORKSPACE_COLS * unitSize ||
         py < yAxisShift ||
         py > yAxisShift + WORKSPACE_ROWS * unitSize;
}

function checkLineAheadForState(pos, direction, storage) {
  var next = nextPosition({x: pos.x, y: pos.y}, direction, 1);
  return hasSegment(storage, pos.x, pos.y, next.x, next.y);
}

function checkBorderAhead() {
  return checkBorderAheadForState(robotPos, robotDirection, 1);
}

function checkLineAhead() {
  return checkLineAheadForState(robotPos, robotDirection, lineSegments);
}

function checkVirtualBorderAhead() {
  return checkBorderAheadForState(virtualPos, virtualDirection, 1);
}

function checkVirtualLineAhead() {
  return checkLineAheadForState(virtualPos, virtualDirection, virtualLineSegments);
}

function doDrawerForward( steps ) {
  if( checkBorderAheadForState(robotPos, robotDirection, steps) ) {
    runtimeError = 'Cangurul nu poate executa PAS: a ajuns la marginea campului.';
    return;
  }
  var previousPen = robotPos['pen'];
  robotPos['pen'] = true;
  var delta = directionDelta( steps, robotDirection );
  doDrawerMove( robotPos['x'] + delta.x, robotPos['y'] + delta.y );
  robotPos['pen'] = previousPen;
}

function doDrawerJump( steps ) {
  if( checkBorderAheadForState(robotPos, robotDirection, steps) ) {
    runtimeError = 'Cangurul nu poate executa SALT: a ajuns la marginea campului.';
    return;
  }
  var previousPen = robotPos['pen'];
  robotPos['pen'] = false;
  var delta = directionDelta( steps, robotDirection );
  doDrawerMove( robotPos['x'] + delta.x, robotPos['y'] + delta.y );
  robotPos['pen'] = previousPen;
}

function doDrawerTurn( angle ) {
  angle = Number(angle) || 0;
  robotDirection = (robotDirection + angle) % 360;
  if( robotDirection < 0 ) robotDirection += 360;
  display();
}

function refreshSensorPanel() {
  var lineBox = document.getElementById('sensorLine');
  var borderBox = document.getElementById('sensorBorder');
  if( lineBox ) lineBox.textContent = 'E_LINIE: ' + (checkLineAhead() ? 'ADEVARAT' : 'FALS');
  if( borderBox ) borderBox.textContent = 'E_MARGINE: ' + (checkBorderAhead() ? 'ADEVARAT' : 'FALS');
}

function manualPas() {
  if( runType != runTypes.NONE ) return;
  runtimeError = '';
  doDrawerForward(1);
  if( runtimeError.length ) Blockly.alert('Comanda refuzata', runtimeError);
}

function manualSalt() {
  if( runType != runTypes.NONE ) return;
  runtimeError = '';
  doDrawerJump(1);
  if( runtimeError.length ) Blockly.alert('Comanda refuzata', runtimeError);
}

function manualRotire() {
  if( runType != runTypes.NONE ) return;
  doDrawerTurn(-90);
}

function setFocusButtonState( buttonId, isActive ) {
  var button = document.getElementById( buttonId );
  if( ! button ) return;
  if( button.classList ) {
    if( isActive ) button.classList.add('activeView');
    else button.classList.remove('activeView');
  }
  else if( isActive ) addClass( buttonId, 'activeView' );
  else removeClass( buttonId, 'activeView' );
}

function refreshLayoutIndicators() {
  var stageSizeValue = document.getElementById('stageSizeValue');
  var blocklySizeValue = document.getElementById('blocklySizeValue');
  var editorSizeValue = document.getElementById('editorSizeValue');

  if( stageSizeValue ) stageSizeValue.textContent = Math.round( uiLayout.stageScale * 100 ) + '%';
  if( blocklySizeValue ) blocklySizeValue.textContent = uiLayout.blocklyMinHeight + ' px';
  if( editorSizeValue ) editorSizeValue.textContent = uiLayout.editorHeight + ' px';

  setFocusButtonState( 'focusAllButton', uiLayout.focus == 'all' );
  setFocusButtonState( 'focusExecutionButton', uiLayout.focus == 'execution' );
  setFocusButtonState( 'focusBlocksButton', uiLayout.focus == 'blocks' );
  setFocusButtonState( 'focusCodeButton', uiLayout.focus == 'code' );
}

function applyUserLayout() {
  var leftPane = document.getElementById('leftPane');
  var rightPane = document.getElementById('rightPane');
  var editorPane = document.getElementById('editorPane');
  var visualization = document.getElementById('visualization');
  var displayCanvas = document.getElementById('display');
  var editorNode = document.getElementById('editor');

  if( ! leftPane || ! rightPane || ! editorPane || ! visualization || ! displayCanvas || ! blocklyArea || ! blocklyDiv || ! editorNode )
    return;

  var showExecution = (uiLayout.focus == 'all' || uiLayout.focus == 'execution');
  var showBlocks = (uiLayout.focus == 'all' || uiLayout.focus == 'blocks');
  var showCode = (uiLayout.focus == 'all' || uiLayout.focus == 'code');

  leftPane.style.display = showExecution ? '' : 'none';
  rightPane.style.display = showBlocks ? '' : 'none';
  editorPane.style.display = showCode ? '' : 'none';
  blocklyDiv.style.display = showBlocks ? 'block' : 'none';

  var stageSize = Math.round( MAZE_WIDTH * uiLayout.stageScale );
  visualization.style.width = stageSize + 'px';
  visualization.style.height = stageSize + 'px';
  displayCanvas.style.width = stageSize + 'px';
  displayCanvas.style.height = stageSize + 'px';

  editorNode.style.height = uiLayout.editorHeight + 'px';

  adjustBlocklyArea();
  refreshLayoutIndicators();
  if( showBlocks ) onResize();
  if( editor && typeof editor.resize == 'function' ) editor.resize();
}

function resizeStage( delta ) {
  uiLayout.stageScale = clampValue( roundToStep( uiLayout.stageScale + delta, 0.1 ), 0.6, 1.8 );
  applyUserLayout();
}

function resizeBlockly( delta ) {
  uiLayout.blocklyMinHeight = clampValue( uiLayout.blocklyMinHeight + delta, 280, 1200 );
  applyUserLayout();
}

function resizeEditor( delta ) {
  uiLayout.editorHeight = clampValue( uiLayout.editorHeight + delta, 180, 900 );
  applyUserLayout();
}

function setLayoutFocus( focusMode ) {
  uiLayout.focus = focusMode;
  applyUserLayout();
}

function scheduleDrawerShow( blockId, state ) {
  addStepPause( blockId );
  programCode.push( [ blockId, 'show', state ] );
  virtualPos['show'] = state;
}

function schedulePenDown( blockId, state ) {
  addStepPause( blockId );
  programCode.push( [ blockId, 'pen', state ] );
  virtualPos['pen'] = state;
}

function scheduleDrawerMove( blockId, absX, absY ) {
  addStepPause( blockId );
  programCode.push( [ blockId, 'move', absX, absY ] );
  if( virtualPos['pen'] ) addSegment(virtualLineSegments, virtualPos['x'], virtualPos['y'], absX, absY);
  virtualPos['x'] = absX;
  virtualPos['y'] = absY;
}

function scheduleDrawerMoveRel( blockId, deltaX, deltaY ) {
  addStepPause( blockId );
  programCode.push( [ blockId, 'moveRel', deltaX, deltaY ] );
  if( virtualPos['pen'] ) addSegment(virtualLineSegments, virtualPos['x'], virtualPos['y'], virtualPos['x'] + deltaX, virtualPos['y'] + deltaY);
  virtualPos['x'] = virtualPos['x'] + deltaX;
  virtualPos['y'] = virtualPos['y'] + deltaY;
}

function scheduleDrawerForward( blockId, steps ) {
  addStepPause( blockId );
  steps = Number(steps) || 0;
  if( checkBorderAheadForState(virtualPos, virtualDirection, steps) ) {
    runtimeError = 'Cangurul nu poate executa PAS: a ajuns la marginea campului.';
    programCode.push( [ blockId, 'crash' ] );
    return;
  }
  programCode.push( [ blockId, 'forward', steps ] );
  var delta = directionDelta( steps, virtualDirection );
  addSegment(virtualLineSegments, virtualPos['x'], virtualPos['y'], virtualPos['x'] + delta.x, virtualPos['y'] + delta.y);
  virtualPos['x'] = virtualPos['x'] + delta.x;
  virtualPos['y'] = virtualPos['y'] + delta.y;
}

function scheduleDrawerJump( blockId, steps ) {
  addStepPause( blockId );
  steps = Number(steps) || 0;
  if( checkBorderAheadForState(virtualPos, virtualDirection, steps) ) {
    runtimeError = 'Cangurul nu poate executa SALT: a ajuns la marginea campului.';
    programCode.push( [ blockId, 'crash' ] );
    return;
  }
  programCode.push( [ blockId, 'jump', steps ] );
  var delta = directionDelta( steps, virtualDirection );
  virtualPos['x'] = virtualPos['x'] + delta.x;
  virtualPos['y'] = virtualPos['y'] + delta.y;
}

function scheduleDrawerTurn( blockId, angle ) {
  addStepPause( blockId );
  angle = Number(angle) || 0;
  programCode.push( [ blockId, 'turn', angle ] );
  virtualDirection = (virtualDirection + angle) % 360;
  if( virtualDirection < 0 ) virtualDirection += 360;
}

function scheduleDrawerColour( blockId, colour ) {
  addStepPause( blockId );
  programCode.push( [ blockId, 'colour', colour ] );
}

function scheduleDrawerFill( blockId, colour ) {
  addStepPause( blockId );
  programCode.push( [ blockId, 'fill', colour ] );
}

//======================= DRAW MAP =======================
function drawMap( primary = true, variant = 0 ) {
  startPos = { 'x': 0, 'y': 0, 'show': false, 'pen': false, 
               'width': 2, 'unit': 20 };

  var param = Maps[Level];
  if( typeof param['x'] != 'undefined' ) startPos['x'] = param['x'];
  if( typeof param['y'] != 'undefined' ) startPos['y'] = param['y'];
  if( typeof param['show'] != 'undefined' ) startPos['show'] = param['show'];
  if( typeof param['pen'] != 'undefined' ) startPos['pen'] = param['pen'];
  if( typeof param['width'] != 'undefined' ) startPos['width'] = param['width'];
  if( typeof param['unit'] != 'undefined' ) unitSize = param['unit'];
  if( typeof param['cols'] != 'undefined' ) WORKSPACE_COLS = param['cols'];
  else WORKSPACE_COLS = 40;
  if( typeof param['rows'] != 'undefined' ) WORKSPACE_ROWS = param['rows'];
  else WORKSPACE_ROWS = 40;
  if( typeof param['direction'] != 'undefined' ) startDirection = param['direction'];
  else startDirection = 0;
  xAxisShift = Math.max( DEFAULT_STAGE_MARGIN, unitSize );
  yAxisShift = Math.max( DEFAULT_STAGE_MARGIN, unitSize );
  MAZE_WIDTH = WORKSPACE_COLS * unitSize + 2 * xAxisShift;
  MAZE_HEIGHT = WORKSPACE_ROWS * unitSize + 2 * yAxisShift;

  var displayCanvas = document.getElementById('display');
  var answerCanvas = document.getElementById('answer');
  var scratchCanvas = document.getElementById('scratch');
  var gridCanvas = document.getElementById('grid');
  var visualization = document.getElementById('visualization');

  displayCanvas.width = MAZE_WIDTH;
  displayCanvas.height = MAZE_HEIGHT;
  answerCanvas.width = MAZE_WIDTH;
  answerCanvas.height = MAZE_HEIGHT;
  scratchCanvas.width = MAZE_WIDTH;
  scratchCanvas.height = MAZE_HEIGHT;
  gridCanvas.width = MAZE_WIDTH;
  gridCanvas.height = MAZE_HEIGHT;
  if( visualization ) {
    visualization.style.width = MAZE_WIDTH + 'px';
    visualization.style.height = MAZE_HEIGHT + 'px';
  }

  ctxDisplay = displayCanvas.getContext('2d');
  ctxAnswer = answerCanvas.getContext('2d');
  ctxScratch = scratchCanvas.getContext('2d');
  ctxGrid = gridCanvas.getContext('2d');

  robotPos = { 'x': startPos['x'], 'y': startPos['y'], 
               'show': startPos['show'], 'pen': startPos['pen'], 
               'width': startPos['width'] };

  ctxScratch.lineWidth = robotPos['width']; 

  robotDirection = startDirection;
  virtualDirection = startDirection;

  drawAnswer();

  restoreField();
  applyUserLayout();

}

//========================== ROBOT HTML =========================================

function robotHTML( header ) {
  return '<style>table#header td {margin:0; padding:0;}</style>' +
'<table id="header" width="100%" style="margin:0;"><tr><td><h1><span id="title" style="margin-right:10px;">' + header + '</span>' +
'<span id="levelMenu"></span>' +
'<span id="starDiv"><img id="bigStar" src="./Media/big-star.gif" align="top" width="35" height="34">' +
'<span id="totalStars">12</span></span></h1></td><td align="right">' +
'<span style="color:#666;font-size:14px;">Model didactic inspirat din manual de informatică pentru clasa 8</span>' +
'</td></tr></table>' +
'<table id="mainLayout" width="100%"><tr><td id="leftPane"><table id="statusBar" width="400"><tr><td>' +
'<span id="prevVar">' +
'<img id="prevImg" src="./Media/prev-icon-gray.png" title="Mergi la varianta anterioara" onclick="prevFieldVariant();"></span>' +
'</td><td>' +
'<span id="multimap" style="left:-32px;">Varianta <span id="mapcount"></span></span>' +
'<span id="rating">Evaluarea solutiei:' +
'<img src="./Media/star.gif" class="star" id="star1"><img src="./Media/star.gif" class="star" id="star2">' +
'<img src="./Media/star.gif" class="star" id="star3"><img src="./Media/star.gif" class="star" id="star4">' +
'<img src="./Media/star.gif" class="star" id="star5">' +
'</span></td><td align="right">' +
'<span id="nextVar">' +
'<img id="nextImg" src="./Media/next-icon.png" title="Mergi la varianta urmatoare" onclick="nextFieldVariant();"></span>' +
'</td></tr></table></td><td>' +
'  <div id="capacityBubble">' +
'   <label for="file-load" style="cursor: pointer;position:relative;top:6px;margin:0 5px 0 20px;">' +
'   <img id="upload" src="./Media/open.gif" title="Deschide un program salvat (.xml sau .cng)">' +
'   <input type="file" id="file-load" accept=".xml,.cng,.txt" style="display:none;" onclick="this.value=null;" onchange="loadProgramFromDisk();"></label>' +
'   <img id="save" src="./Media/save.gif" title="Salveaza programul curent" style="cursor: pointer;position:relative;top:6px;margin-right:5px;" onclick="saveProgramToDisk();" />' +
'    <span id="blockCount">Mai poti adauga in program <span id="capacity">0 blocuri</span></span>.' +
'  </div>' +
'</td>' +
'</tr>' +
'<tr>' +
'<td valign="top">' +
'  <div id="visualization" style="border:none;">' +
'    <canvas id="scratch" width="400" height="400" style="display: none"></canvas>' +
'    <canvas id="answer" width="400" height="400" style="display: none"></canvas>' +
'    <canvas id="grid" width="400" height="400" style="display: none"></canvas>' +
'    <canvas id="display" width="400" height="400" style="border:1px solid #cccccc;"></canvas>' +
'  </div>' +
'  <table id="controlsLayout" width="100%"><tr><td valign="top">' +
'  <svg id="slider" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="150" height="50">' +
'    <clipPath id="slowClipPath"><rect width="26" height="12" x="5" y="14"></rect></clipPath>' +
'    <image xlink:href="Media/icons.png" height="63" width="105" x="-21" y="-21" clip-path="url(#slowClipPath)"></image>' +
'    <clipPath id="fastClipPath"><rect width="26" height="16" x="120" y="10"></rect></clipPath>' +
'    <image xlink:href="Media/icons.png" height="63" width="105" x="120" y="-21" clip-path="url(#fastClipPath)"></image>' +
'    <line id="sliderTrack" x1="10" y1="35" x2="140" y2="35"></line>' +
'    <rect id="trackTarget" style="opacity: 0" x="-10" y="15" width="170" height="40" rx="20" ry="20"></rect>' +
'    <path id="sliderKnob" d="m 0,0 l -8,8 v 12 h 16 v -12 z" transform="translate(75,23)"></path>' +
'    <circle id="knobTarget" style="opacity: 0" r="20" cy="35" cx="75"></circle>' +
'  </svg> ' +
'  </td><td> ' +
'  <div id="manualControls" style="text-align:right; margin-bottom:6px;">' +
'    <button type="button" title="Comanda manuala PAS" onclick="manualPas();">PAS</button>' +
'    <button type="button" title="Comanda manuala SALT" onclick="manualSalt();">SALT</button>' +
'    <button type="button" title="Comanda manuala ROTIRE" onclick="manualRotire();">ROTIRE</button>' +
'  </div>' +
'  <div id="resizeControls" style="text-align:right; margin-bottom:6px;">' +
'    <div class="resizeRow"><span class="resizeLabel">Executie <span id="stageSizeValue">100%</span></span><button type="button" onclick="resizeStage(-0.1);">-</button><button type="button" onclick="resizeStage(0.1);">+</button></div>' +
'    <div class="resizeRow"><span class="resizeLabel">Blocuri <span id="blocklySizeValue">460 px</span></span><button type="button" onclick="resizeBlockly(-80);">-</button><button type="button" onclick="resizeBlockly(80);">+</button></div>' +
'    <div class="resizeRow"><span class="resizeLabel">Cod <span id="editorSizeValue">400 px</span></span><button type="button" onclick="resizeEditor(-60);">-</button><button type="button" onclick="resizeEditor(60);">+</button></div>' +
'  </div>' +
'  <div id="runControls" style="text-align:right;">' +
'    <button id="stepButton" title="Executa programul pas cu pas" onclick="runCode(true);">' +
'      <img src="Media/1x1.gif" class="step icon21">&nbsp;Pas' +
'    </button>' +
'    <button id="runButton" title="Porneste programul scris de tine" onclick="runCode();">' +
'      <img src="Media/1x1.gif" class="run icon21">&nbsp;Start' +
'    </button>' +
'    <button id="resetButton" title="Opreste programul si revino la starea initiala" onclick="reset();" style="display:none;">' +
'      <img src="Media/1x1.gif" class="stop icon21">&nbsp;Resetare</button>' +
'  </div>' +
'  <div id="sensorPanel" style="margin-top:8px; text-align:right; color:#444; font-size:13px;">' +
'    <span id="sensorLine">E_LINIE: FALS</span><br>' +
'    <span id="sensorBorder">E_MARGINE: FALS</span>' +
'  </div>' +
'  <div id="focusControls" style="margin-top:8px; text-align:right;">' +
'    <button id="focusAllButton" type="button" title="Afiseaza toate zonele" onclick="setLayoutFocus(\'all\');">Toate</button>' +
'    <button id="focusExecutionButton" type="button" title="Afiseaza doar executia" onclick="setLayoutFocus(\'execution\');">Executie</button>' +
'    <button id="focusBlocksButton" type="button" title="Afiseaza doar blocurile" onclick="setLayoutFocus(\'blocks\');">Blocuri</button>' +
'    <button id="focusCodeButton" type="button" title="Afiseaza doar codul" onclick="setLayoutFocus(\'code\');">Cod</button>' +
'  </div>' +
'  </td></tr></table>' +
'  <div id="counters"></div>' +
'</td>' +
'<td id="rightPane" style="height:99%;width:100%;" valign="top">' +
'  <div id="blocklyArea" style="text-align:center;"></div>' +
'  <div id="blocklyDiv" style="position:absolute;"></div>' +
'</td>' +
'</tr>' +
'<tr>' +
'<td id="editorPane" colspan="2">' +
'  <h2>Program in limbajul <select id="lang" onchange="loadCodeToEditor(this)";>' +
'    <option disabled>Alege limbajul</option>' +
'    <option value="cng">CNG clasic</option>' +
'    <option value="py" selected>Python</option>' +
'    <option value="js">JavaScript</option>' +
'    <option value="php">PHP</option>' +
'    <option value="dart">Dart</option>' +
'    <option value="lua">Lua</option>' +
'    <option value="xml">XML</option>' +
'   </select>' +
'   </h2>' +
'  <div id="editor" style="height: 400px;width:500px;"></div>' +
'</td>' +
'</tr>' +
'</table>' +
'<svg height="8" width="8" xmlns="http://www.w3.org/2000/svg" version="1.1">' +
'<pattern id="crosshatch" patternUnits="userSpaceOnUse" width="8" height="8">' +
'<rect width="8" height="8" fill="#666"/>' +
'<path d="M0 0L8 8ZM8 0L0 8Z" stroke-width="0.5" stroke="#aaa"/>' +
'</pattern></svg>' +
'';
}

