/**
 * @license
 * Copyright 2021
 * SPDX-License-Identifier: Apache-2.0
 */

var Maps =
[ { 'mode': 'free' },
  { 'x': 0, 'y': 0, 'show': true, 'pen': false, 'direction': 0, 'width': 2, 'unit': 10, 'cols': 40, 'rows': 40 },
];

var BlockLimit = [0,
    [100],
    ];

var someBlocksLimit = [ {},
  {  },
];

var Answers = [ null,
function() { drawGrid(unitSize, unitSize); 
  },
];

var HelpContent = [ '',
    'Executantul Cangurul porneste din partea stanga-sus, orientat spre dreapta. Foloseste blocurile PAS, SALT, ROTIRE, REPETA, CAT, DACA si procedurile pentru a construi algoritmi.',
];

function initThisApplication() {
   workspace.registerToolboxCategoryCallback(
                   'PROCEDURES_ONLY', flyoutProcedureOnlyBlocks );
   workspace.registerToolboxCategoryCallback(
                   'VARIABLE_MY', flyoutVariableBlocks );
   checkPictureMode = checkPictureModes.EXACT;
}

function BlocklyBlocks( Level ) {
  if( [1].includes( Level ) ) return '' +
  '<xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">' +
  '<category name="Cangurul" colour="%{BKY_ROBOT_HUE}">' +
  '  <block type="drawer_pas"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="drawer_salt"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="drawer_rotire"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="drawer_forward"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="drawer_turn"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="drawer_jump"></block>' +
  '</category>' +
  '<category name="Conditii" colour="%{BKY_LOGIC_HUE}">' +
  '  <block type="drawer_is_line"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="drawer_is_border"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="logic_negate"></block>' +
  '</category>' +
  '<category name="Structuri" colour="%{BKY_LOOPS_HUE}">' +
  '  <block type="controls_repeat_list"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="controls_whileUntil"></block>' +
  '  <sep gap="5"></sep>' +
  '  <block type="controls_if"></block>' +
  '</category>' +
  '<category name="Matematică" colour="%{BKY_MATH_HUE}">' +
  '  <block type="math_number">' +
  '    <field name="NUM">1</field>' +
  '  </block>' +
  '  <block type="math_negate"></block>' +
  '</category>' +
  '<category name="Proceduri" custom="PROCEDURES_ONLY" colour="%{BKY_PROCEDURES_HUE}">' +
  '</category>' +
  '</xml>';
  return '';
}
