/**
 * Legacy .cng parser/transpiler for the original Cangur language.
 * It converts the old teaching syntax into JavaScript understood by the
 * existing JS-Interpreter integration used by the web app.
 */

(function(global) {
  'use strict';

  function CngParseError(message, lineNumber, lineText) {
    this.name = 'CngParseError';
    this.message = message;
    this.lineNumber = lineNumber || 0;
    this.lineText = lineText || '';
  }

  CngParseError.prototype = Object.create(Error.prototype);
  CngParseError.prototype.constructor = CngParseError;

  function sanitizeProcedureName(name) {
    var safeName = String(name || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '_');
    if (!safeName.length) {
      safeName = 'procedura';
    }
    if (/^[0-9]/.test(safeName)) {
      safeName = '_' + safeName;
    }
    return safeName;
  }

  function createLineInfo(rawText, index) {
    var commentFree = String(rawText || '').replace(/\/\/.*$/, '');
    return {
      raw: String(rawText || ''),
      text: commentFree.trim(),
      upper: commentFree.trim().toUpperCase(),
      lineNumber: index + 1
    };
  }

  function createState(lines) {
    return {
      lines: lines,
      index: 0,
      procedures: {},
      procedureOrder: [],
      main: []
    };
  }

  function currentLine(state) {
    return state.lines[state.index] || null;
  }

  function advance(state) {
    state.index += 1;
  }

  function isStatementTerminator(upperText) {
    return upperText === 'SFIRSITUL REPETARII' ||
      upperText === 'SFIRSITUL CICLULUI' ||
      upperText === 'SFIRSITUL PROCEDURII' ||
      upperText === ']';
  }

  function parseCondition(line) {
    var match = line.upper.match(/^CIT(?:\s+(NU))?\s+(E_LINIE|E_MARGINE)$/);
    if (!match) {
      throw new CngParseError('Condiție CIT invalidă.', line.lineNumber, line.raw);
    }
    return {
      negated: !!match[1],
      sensor: match[2]
    };
  }

  function parseRepeatCount(line) {
    var match = line.upper.match(/^REPETA\s+(-?\d+)(?:\s+ORI)?$/);
    if (!match) {
      throw new CngParseError('Instrucțiune REPETA invalidă.', line.lineNumber, line.raw);
    }
    return parseInt(match[1], 10);
  }

  function parseProcedureHeader(line) {
    var match = line.text.match(/^procedura\s+(.+)$/i);
    if (!match) {
      throw new CngParseError('Declarație PROCEDURA invalidă.', line.lineNumber, line.raw);
    }
    return match[1].trim();
  }

  function parseExecuteName(line) {
    var match = line.text.match(/^executa\s+(.+)$/i);
    if (!match) {
      throw new CngParseError('Instrucțiune EXECUTA invalidă.', line.lineNumber, line.raw);
    }
    return match[1].trim();
  }

  function parseStatements(state, terminators) {
    var statements = [];
    while (state.index < state.lines.length) {
      var line = currentLine(state);
      if (!line) {
        break;
      }
      if (!line.text.length) {
        advance(state);
        continue;
      }
      if (terminators.indexOf(line.upper) >= 0) {
        break;
      }
      if (line.upper === '[') {
        advance(state);
        var bracketBody = parseStatements(state, [']']);
        var closingBracket = currentLine(state);
        if (!closingBracket || closingBracket.upper !== ']') {
          throw new CngParseError('Lipsește ] pentru blocul principal.', line.lineNumber, line.raw);
        }
        advance(state);
        statements = statements.concat(bracketBody);
        continue;
      }
      if (line.upper.indexOf('PROCEDURA ') === 0) {
        var procedureName = parseProcedureHeader(line);
        var safeName = sanitizeProcedureName(procedureName);
        if (state.procedures[safeName]) {
          throw new CngParseError('Procedura este definită de mai multe ori: ' + procedureName, line.lineNumber, line.raw);
        }
        advance(state);
        var procedureBody = parseStatements(state, ['SFIRSITUL PROCEDURII']);
        var procedureEnd = currentLine(state);
        if (!procedureEnd || procedureEnd.upper !== 'SFIRSITUL PROCEDURII') {
          throw new CngParseError('Lipsește SFIRSITUL PROCEDURII.', line.lineNumber, line.raw);
        }
        advance(state);
        state.procedures[safeName] = {
          name: procedureName,
          safeName: safeName,
          body: procedureBody,
          lineNumber: line.lineNumber
        };
        state.procedureOrder.push(safeName);
        continue;
      }
      if (line.upper.indexOf('REPETA ') === 0) {
        var repeatCount = parseRepeatCount(line);
        advance(state);
        var repeatBody = parseStatements(state, ['SFIRSITUL REPETARII']);
        var repeatEnd = currentLine(state);
        if (!repeatEnd || repeatEnd.upper !== 'SFIRSITUL REPETARII') {
          throw new CngParseError('Lipsește SFIRSITUL REPETARII.', line.lineNumber, line.raw);
        }
        advance(state);
        statements.push({
          type: 'repeat',
          count: repeatCount,
          body: repeatBody,
          lineNumber: line.lineNumber
        });
        continue;
      }
      if (line.upper.indexOf('CIT ') === 0) {
        var condition = parseCondition(line);
        advance(state);
        var whileBody = parseStatements(state, ['SFIRSITUL CICLULUI']);
        var whileEnd = currentLine(state);
        if (!whileEnd || whileEnd.upper !== 'SFIRSITUL CICLULUI') {
          throw new CngParseError('Lipsește SFIRSITUL CICLULUI.', line.lineNumber, line.raw);
        }
        advance(state);
        statements.push({
          type: 'while',
          condition: condition,
          body: whileBody,
          lineNumber: line.lineNumber
        });
        continue;
      }
      if (line.upper === 'PAS') {
        statements.push({ type: 'command', command: 'PAS', lineNumber: line.lineNumber });
        advance(state);
        continue;
      }
      if (line.upper === 'SALT') {
        statements.push({ type: 'command', command: 'SALT', lineNumber: line.lineNumber });
        advance(state);
        continue;
      }
      if (line.upper === 'ROTIRE') {
        statements.push({ type: 'command', command: 'ROTIRE', lineNumber: line.lineNumber });
        advance(state);
        continue;
      }
      if (line.upper.indexOf('EXECUTA ') === 0) {
        statements.push({
          type: 'call',
          name: parseExecuteName(line),
          lineNumber: line.lineNumber
        });
        advance(state);
        continue;
      }
      if (isStatementTerminator(line.upper)) {
        break;
      }
      throw new CngParseError('Instrucțiune necunoscută.', line.lineNumber, line.raw);
    }
    return statements;
  }

  function parseCng(source) {
    var lines = String(source || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(createLineInfo);
    var state = createState(lines);
    state.main = parseStatements(state, []);
    while (state.index < state.lines.length) {
      var line = currentLine(state);
      if (line && line.text.length) {
        throw new CngParseError('Text rămas neinterpretat.', line.lineNumber, line.raw);
      }
      advance(state);
    }
    return {
      procedures: state.procedureOrder.map(function(safeName) { return state.procedures[safeName]; }),
      main: state.main
    };
  }

  function compileCondition(condition) {
    var sensorFn = condition.sensor === 'E_LINIE' ? 'isLine' : 'isBorder';
    return (condition.negated ? '!' : '') + sensorFn + "('legacy')";
  }

  function compileStatements(statements, procedures, indentLevel) {
    var indent = new Array(indentLevel + 1).join('  ');
    var code = '';
    var i;
    for (i = 0; i < statements.length; i += 1) {
      var stmt = statements[i];
      if (stmt.type === 'command') {
        if (stmt.command === 'PAS') {
          code += indent + "forward('legacy', 1);\n";
        }
        else if (stmt.command === 'SALT') {
          code += indent + "jump('legacy', 1);\n";
        }
        else if (stmt.command === 'ROTIRE') {
          code += indent + "turn('legacy', -90);\n";
        }
      }
      else if (stmt.type === 'repeat') {
        code += indent + 'for (var repeatIndex' + indentLevel + '_' + i + ' = 0; repeatIndex' + indentLevel + '_' + i + ' < ' + stmt.count + '; repeatIndex' + indentLevel + '_' + i + ' += 1) {\n';
        code += compileStatements(stmt.body, procedures, indentLevel + 1);
        code += indent + '}\n';
      }
      else if (stmt.type === 'while') {
        code += indent + 'while (' + compileCondition(stmt.condition) + ') {\n';
        code += compileStatements(stmt.body, procedures, indentLevel + 1);
        code += indent + '}\n';
      }
      else if (stmt.type === 'call') {
        var safeName = sanitizeProcedureName(stmt.name);
        if (!procedures[safeName]) {
          throw new Error('Procedură nedefinită: ' + stmt.name);
        }
        code += indent + safeName + '();\n';
      }
      else {
        throw new Error('Tip intern necunoscut: ' + stmt.type);
      }
    }
    return code;
  }

  function transpileCng(source) {
    var ast = parseCng(source);
    var procedureMap = {};
    var code = '';
    var i;
    for (i = 0; i < ast.procedures.length; i += 1) {
      procedureMap[ast.procedures[i].safeName] = ast.procedures[i];
    }
    for (i = 0; i < ast.procedures.length; i += 1) {
      var procedure = ast.procedures[i];
      code += 'function ' + procedure.safeName + '() {\n';
      code += compileStatements(procedure.body, procedureMap, 1);
      code += '}\n\n';
    }
    code += compileStatements(ast.main, procedureMap, 0);
    return {
      ast: ast,
      code: code.trim() + '\n'
    };
  }

  global.CngParseError = CngParseError;
  global.parseCng = parseCng;
  global.transpileCng = transpileCng;
})(this);
