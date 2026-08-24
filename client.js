window.__ModuleLoader__.load({
  id: 'dsh-plugin-text-quote',
  factory: function(require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var inject = ['slots']
    var notesBySession = new Map()
    var bindings = new Map()
    var listeners = new Map()
    var markers = new Map()
    var activeSessionId = null
    var selectionMenu = null
    var editor = null
    var pendingSelection = null
    var submitArmed = false
    var START = '<!-- dsh-annotations:start -->'
    var END = '<!-- dsh-annotations:end -->'
    var DRAFT_TOKEN = '\u2063'

    function listOf(sessionId) {
      var list = notesBySession.get(sessionId)
      if (!list) { list = []; notesBySession.set(sessionId, list) }
      return list
    }

    function emit(sessionId) {
      var set = listeners.get(sessionId)
      if (set) set.forEach(function(fn) { fn() })
      renderMarkers()
    }

    function subscribe(sessionId, fn) {
      var set = listeners.get(sessionId)
      if (!set) { set = new Set(); listeners.set(sessionId, set) }
      set.add(fn)
      return function() { set.delete(fn) }
    }

    function annotationBlock(list) {
      if (!list.length) return ''
      var rows = [START, '<对话注释>']
      list.forEach(function(note, index) {
        rows.push('[注释 ' + (index + 1) + ']')
        rows.push('所选文本：')
        rows.push(note.text)
        rows.push('用户评论：')
        rows.push(note.comment)
      })
      rows.push('</对话注释>', END)
      return rows.join('\n')
    }

    function draftOf(sessionId) {
      var binding = bindings.get(sessionId)
      return binding && binding.input && typeof binding.input.draft === 'string' ? binding.input.draft : ''
    }

    function syncDraftToken(sessionId) {
      var binding = bindings.get(sessionId)
      if (!binding || !binding.inputActions) return
      var draft = draftOf(sessionId)
      var clean = draft.split(DRAFT_TOKEN).join('')
      var hasNotes = listOf(sessionId).length > 0
      binding.inputActions.setDraft(hasNotes ? DRAFT_TOKEN + clean : clean)
    }

    function injectBeforeSubmit() {
      if (submitArmed || !activeSessionId) return false
      var sessionId = activeSessionId
      var binding = bindings.get(sessionId)
      var list = listOf(sessionId)
      if (!binding || !binding.inputActions || !list.length) return false
      var draft = draftOf(sessionId).split(DRAFT_TOKEN).join('')
      if (draft.indexOf(START) >= 0) return false
      var block = annotationBlock(list)
      submitArmed = true
      binding.inputActions.setDraft(draft.trim() ? draft + '\n\n' + block : block)
      Promise.resolve().then(function() {
        binding.inputActions.submit()
        notesBySession.set(sessionId, [])
        emit(sessionId)
        submitArmed = false
      })
      return true
    }

    function closeSelectionMenu() {
      if (selectionMenu) selectionMenu.style.display = 'none'
      pendingSelection = null
    }

    function closeEditor() {
      if (editor) editor.remove()
      editor = null
    }

    function markerMap(sessionId) {
      var map = markers.get(sessionId)
      if (!map) { map = new Map(); markers.set(sessionId, map) }
      return map
    }

    function renderMarkers() {
      markers.forEach(function(map, sessionId) {
        var live = new Set(listOf(sessionId).map(function(note) { return note.id }))
        map.forEach(function(marker, id) { if (!live.has(id)) { marker.remove(); map.delete(id) } })
      })
      if (!activeSessionId) return
      var map = markerMap(activeSessionId)
      listOf(activeSessionId).forEach(function(note, index) {
        var marker = map.get(note.id)
        if (!marker) {
          marker = document.createElement('button')
          marker.type = 'button'
          marker.className = 'dsh-note-marker'
          marker.addEventListener('click', function() { openEditor(note.id) })
          document.body.appendChild(marker)
          map.set(note.id, marker)
        }
        marker.textContent = String(index + 1)
        var rect
        try { rect = note.range && note.range.getBoundingClientRect() } catch (error) { rect = null }
        if (!rect || (!rect.width && !rect.height)) { marker.style.display = 'none'; return }
        marker.style.display = 'grid'
        marker.style.left = Math.min(window.innerWidth - 32, rect.right + 5) + 'px'
        marker.style.top = Math.max(8, rect.top - 12) + 'px'
      })
    }

    function removeNote(sessionId, id) {
      notesBySession.set(sessionId, listOf(sessionId).filter(function(note) { return note.id !== id }))
      closeEditor()
      emit(sessionId)
      syncDraftToken(sessionId)
    }

    function saveEditor(id, text, range, comment) {
      comment = String(comment || '').trim()
      if (!comment || !activeSessionId) return false
      var list = listOf(activeSessionId)
      if (id) {
        var current = list.find(function(note) { return note.id === id })
        if (current) current.comment = comment
      } else {
        list.push({ id:Date.now().toString(36) + Math.random().toString(36).slice(2, 7), text:text, comment:comment, range:range })
      }
      emit(activeSessionId)
      syncDraftToken(activeSessionId)
      closeEditor()
      return true
    }

    function openEditor(id, selectedText, selectedRange, selectedRect) {
      closeSelectionMenu()
      closeEditor()
      if (!activeSessionId) return
      var note = id ? listOf(activeSessionId).find(function(item) { return item.id === id }) : null
      var rect = selectedRect
      if (!rect && note && note.range) {
        try { rect = note.range.getBoundingClientRect() } catch (error) {}
      }
      if (!rect) rect = { right:window.innerWidth / 2, top:window.innerHeight / 2 }
      editor = document.createElement('div')
      editor.className = 'dsh-note-editor'
      editor.innerHTML = '<textarea aria-label="添加批注" placeholder="添加可选评论..."></textarea><div class="dsh-note-editor-actions"><button class="dsh-note-trash" type="button" title="删除批注" aria-label="删除批注">&#128465;</button><span></span><button class="dsh-note-cancel" type="button">取消</button><button class="dsh-note-save" type="button">保存</button></div>'
      editor.style.left = Math.max(12, Math.min(window.innerWidth - 344, rect.right + 16)) + 'px'
      editor.style.top = Math.max(12, Math.min(window.innerHeight - 210, rect.top - 8)) + 'px'
      var textarea = editor.querySelector('textarea')
      textarea.value = note ? note.comment : ''
      editor.querySelector('.dsh-note-trash').addEventListener('click', function() { if (note) removeNote(activeSessionId, note.id); else closeEditor() })
      editor.querySelector('.dsh-note-cancel').addEventListener('click', closeEditor)
      editor.querySelector('.dsh-note-save').addEventListener('click', function() { saveEditor(note && note.id, note ? note.text : selectedText, note ? note.range : selectedRange, textarea.value) })
      textarea.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' || event.isComposing) return
        if (event.shiftKey) return
        event.preventDefault()
        saveEditor(note && note.id, note ? note.text : selectedText, note ? note.range : selectedRange, textarea.value)
      })
      document.body.appendChild(editor)
      textarea.focus()
    }

    function NotesDock(props) {
      var sessionId = props.sessionId
      var state = React.useState(0)
      var setVersion = state[1]
      var openState = React.useState(false)
      var open = openState[0]
      var setOpen = openState[1]
      bindings.set(sessionId, { input:props.input, inputActions:props.inputActions })
      React.useEffect(function() {
        activeSessionId = sessionId
        renderMarkers()
        return subscribe(sessionId, function() { setVersion(function(value) { return value + 1 }) })
      }, [sessionId])
      var list = listOf(sessionId)
      if (!list.length) return null
      return React.createElement('div', { className:'dsh-note-dock' },
        open ? React.createElement('div', { className:'dsh-note-card' }, list.map(function(note, index) {
          return React.createElement('div', { className:'dsh-note-row', key:note.id },
            React.createElement('div', { className:'dsh-note-number' }, String(index + 1) + '.'),
            React.createElement('div', { className:'dsh-note-body' },
              React.createElement('div', { className:'dsh-note-label' }, '所选文本：'),
              React.createElement('div', { className:'dsh-note-selected' }, note.text),
              React.createElement('div', { className:'dsh-note-label' }, '用户评论：'),
              React.createElement('div', { className:'dsh-note-comment' }, note.comment)
            ),
            React.createElement('div', { className:'dsh-note-row-actions' },
              React.createElement('button', { type:'button', title:'编辑批注', 'aria-label':'编辑批注', onClick:function() { openEditor(note.id) } }, '\u270e'),
              React.createElement('button', { type:'button', title:'删除批注', 'aria-label':'删除批注', onClick:function() { removeNote(sessionId, note.id) } }, '\u00d7')
            )
          )
        })) : null,
        React.createElement('button', { type:'button', className:'dsh-note-summary', 'aria-expanded':open, onClick:function() { setOpen(!open) } },
          React.createElement('span', { 'aria-hidden':true }, '\u25a2'),
          React.createElement('span', null, String(list.length) + ' 条注释')
        )
      )
    }

    function apply(ctx) {
      ctx.effect(function() {
        // 静态 manifest 插件没有 styles 闭包参数（动态内联插件专属），用原生 <style> 注入
        var styleEl = document.createElement('style')
        styleEl.setAttribute('data-plugin', 'dsh-plugin-text-quote')
        styleEl.setAttribute('data-plugin-css', 'dsh-plugin-text-quote-styles-v2')
        styleEl.textContent = `
          .dsh-selection-menu{position:fixed;z-index:145;display:none;align-items:stretch;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:18px;background:var(--dsw-alias-bg-module-platform,#fff);box-shadow:0 6px 18px rgba(15,23,42,.16);overflow:hidden;font:13px Inter,"Segoe UI",Arial,sans-serif}.dsh-selection-menu button{min-height:34px;padding:0 12px;border:0;border-right:1px solid var(--dsw-alias-border-l2,#e2e8f0);color:var(--dsw-alias-label-primary,#17212b);background:transparent;cursor:pointer;font:inherit}.dsh-selection-menu button:last-child{border-right:0}.dsh-selection-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f5f9)}
          .dsh-note-marker{position:fixed;z-index:138;width:28px;height:28px;place-items:center;padding:0;border:0;border-radius:14px;color:#fff;background:#1683f3;box-shadow:0 2px 6px rgba(22,131,243,.25);cursor:pointer;font:700 13px Inter,"Segoe UI",Arial,sans-serif}
          .dsh-note-editor{position:fixed;z-index:146;width:320px;min-height:150px;padding:14px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:18px;background:var(--dsw-alias-bg-module-platform,#fff);box-shadow:0 10px 28px rgba(15,23,42,.16);box-sizing:border-box}.dsh-note-editor textarea{display:block;width:100%;height:86px;padding:0;border:0;outline:0;resize:none;color:var(--dsw-alias-label-primary,#17212b);background:transparent;font:14px/1.5 Inter,"Segoe UI",Arial,sans-serif}.dsh-note-editor-actions{display:grid;grid-template-columns:34px 1fr auto auto;align-items:center;gap:8px}.dsh-note-editor-actions button{height:34px;padding:0 13px;border:1px solid var(--dsw-alias-border-l2,#e2e8f0);border-radius:17px;background:transparent;color:var(--dsw-alias-label-primary,#17212b);cursor:pointer;font:13px Inter,"Segoe UI",Arial,sans-serif}.dsh-note-editor-actions .dsh-note-trash{padding:0;border:0;font-size:17px}.dsh-note-editor-actions .dsh-note-save{border-color:#17191c;color:#fff;background:#17191c;font-weight:600}
          .dsh-note-dock{position:relative;display:inline-flex;align-items:center;box-sizing:border-box;font:13px/1.45 Inter,"Segoe UI",Arial,sans-serif}.dsh-note-summary{display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:17px;color:var(--dsw-alias-label-primary,#17212b);background:var(--dsw-alias-bg-module-platform,#fff);cursor:pointer;font:inherit}.dsh-note-card{position:absolute;left:12px;bottom:42px;z-index:132;width:min(690px,calc(100vw - 48px));max-height:360px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:14px;background:var(--dsw-alias-bg-module-platform,#fff);box-shadow:0 10px 28px rgba(15,23,42,.16);overflow:auto;box-sizing:border-box}.dsh-note-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;padding:8px}.dsh-note-row+.dsh-note-row{border-top:1px solid var(--dsw-alias-border-l2,#e2e8f0)}.dsh-note-number{color:var(--dsw-alias-label-tertiary,#64748b)}.dsh-note-label{margin-bottom:2px;color:var(--dsw-alias-label-tertiary,#64748b)}.dsh-note-selected{margin-bottom:10px;color:var(--dsw-alias-label-primary,#17212b)}.dsh-note-comment{color:var(--dsw-alias-label-primary,#17212b)}.dsh-note-row-actions{display:flex;gap:2px}.dsh-note-row-actions button{width:28px;height:28px;padding:0;border:0;border-radius:5px;color:var(--dsw-alias-label-tertiary,#64748b);background:transparent;cursor:pointer;font-size:17px}.dsh-note-row-actions button:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f5f9)}
          .dsh-sent-note-clean{white-space:pre-wrap}.dsh-sent-note-pill{display:flex;align-items:center;gap:6px;align-self:flex-end;height:34px;margin-top:8px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:17px;color:var(--dsw-alias-label-primary,#17212b);background:var(--dsw-alias-bg-module-platform,#fff);cursor:pointer;font:13px Inter,"Segoe UI",Arial,sans-serif}.dsh-sent-note-pill:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f5f9)}.dsh-sent-note-popover{position:fixed;z-index:148;width:min(660px,calc(100vw - 32px));max-height:420px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:14px;color:var(--dsw-alias-label-primary,#17212b);background:var(--dsw-alias-bg-module-platform,#fff);box-shadow:0 10px 28px rgba(15,23,42,.18);overflow:auto;box-sizing:border-box;font:13px/1.5 Inter,"Segoe UI",Arial,sans-serif}.dsh-sent-note-popover .dsh-note-row{padding:10px 8px}
        `
        document.head.appendChild(styleEl)
        return function() { styleEl.remove() }
      }, 'dsh-plugin-text-quote-styles-v2')
      ctx.slots.inject('conversation.input.left', function() { return ctx.slots.register({ name:'conversation.input.left', id:'text-quotes', order:30, label:'对话注释' }, NotesDock) })
      ctx.effect(function() {
        var popover = null
        function closeSentPopover() { if (popover) popover.remove(); popover = null }
        function parseSent(text) {
          var start = text.lastIndexOf(START)
          var end = text.lastIndexOf(END)
          if (start < 0 || end < start) return null
          var block = text.slice(start + START.length, end)
          var clean = (text.slice(0, start) + text.slice(end + END.length)).trim()
          var matches = Array.from(block.matchAll(/\[注释\s+(\d+)\]\s*\n所选文本：\s*\n([\s\S]*?)\n用户评论：\s*\n([\s\S]*?)(?=\n\[注释\s+\d+\]|\n<\/对话注释>|$)/g))
          var notes = matches.map(function(match) { return { index:match[1], text:match[2].trim(), comment:match[3].trim() } })
          return notes.length ? { clean:clean, notes:notes } : null
        }
        function openSentPopover(button, notes) {
          closeSentPopover()
          var rect = button.getBoundingClientRect()
          popover = document.createElement('div')
          popover.className = 'dsh-sent-note-popover'
          notes.forEach(function(note) {
            var row = document.createElement('div')
            row.className = 'dsh-note-row'
            row.innerHTML = '<div class="dsh-note-number"></div><div class="dsh-note-body"><div class="dsh-note-label">&#25152;&#36873;&#25991;&#26412;&#65306;</div><div class="dsh-note-selected"></div><div class="dsh-note-label">&#29992;&#25143;&#35780;&#35770;&#65306;</div><div class="dsh-note-comment"></div></div>'
            row.querySelector('.dsh-note-number').textContent = note.index + '.'
            row.querySelector('.dsh-note-selected').textContent = note.text
            row.querySelector('.dsh-note-comment').textContent = note.comment
            popover.appendChild(row)
          })
          document.body.appendChild(popover)
          popover.style.left = Math.max(12, Math.min(window.innerWidth - popover.offsetWidth - 12, rect.right - popover.offsetWidth)) + 'px'
          popover.style.top = Math.max(12, rect.top - popover.offsetHeight - 8) + 'px'
        }
        function enhanceRow(row) {
          if (!row || row.dataset.dshAnnotationsEnhanced === 'true') return
          var parsed = parseSent(row.textContent || '')
          if (!parsed) return
          var stack = row.firstElementChild
          if (!stack) return
          row.dataset.dshAnnotationsEnhanced = 'true'
          Array.from(stack.children).forEach(function(child) { if ((child.textContent || '').indexOf(START) >= 0) child.style.display = 'none' })
          var clean = document.createElement('div')
          clean.className = 'dsh-sent-note-clean'
          clean.textContent = parsed.clean
          if (parsed.clean) stack.appendChild(clean)
          var pill = document.createElement('button')
          pill.type = 'button'
          pill.className = 'dsh-sent-note-pill'
          pill.innerHTML = '<span aria-hidden="true">&#9635;</span><span>' + parsed.notes.length + ' &#26465;&#27880;&#37322;</span>'
          pill.addEventListener('click', function(event) { event.stopPropagation(); if (popover) closeSentPopover(); else openSentPopover(pill, parsed.notes) })
          stack.appendChild(pill)
        }
        function scan() { document.querySelectorAll('[data-time-hover-root]').forEach(enhanceRow) }
        function onDocumentClick(event) { if (popover && !popover.contains(event.target) && !event.target.closest('.dsh-sent-note-pill')) closeSentPopover() }
        var observer = new MutationObserver(scan)
        observer.observe(document.body, { childList:true, subtree:true })
        document.addEventListener('click', onDocumentClick)
        scan()
        return function() { observer.disconnect(); document.removeEventListener('click', onDocumentClick); closeSentPopover() }
      }, 'dsh-plugin-text-quote-sent-rendering-v3')
      ctx.effect(function() {
        selectionMenu = document.createElement('div')
        selectionMenu.className = 'dsh-selection-menu'
        selectionMenu.innerHTML = '<button type="button">&#28155;&#21152;&#21040;&#23545;&#35805;</button><button type="button">&#26356;&#22810;&#35814;&#24773;</button><button type="button">&#22312;&#20391;&#36793;&#32842;&#22825;&#20013;&#25552;&#38382;</button>'
        document.body.appendChild(selectionMenu)
        selectionMenu.children[0].addEventListener('click', function() {
          if (!pendingSelection) return
          var selected = pendingSelection
          pendingSelection = null
          openEditor(null, selected.text, selected.range, selected.rect)
          var selection = window.getSelection()
          if (selection) selection.removeAllRanges()
        })
        selectionMenu.children[1].addEventListener('click', closeSelectionMenu)
        selectionMenu.children[2].addEventListener('click', closeSelectionMenu)
        function inspectSelection() {
          var selection = window.getSelection()
          if (!selection || selection.isCollapsed || !selection.rangeCount) { closeSelectionMenu(); return }
          var node = selection.anchorNode && (selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement)
          if (!node || node.closest('textarea,input,[contenteditable="true"],.dsh-selection-menu,.dsh-note-editor,.dsh-note-card')) { closeSelectionMenu(); return }
          var text = selection.toString().trim()
          if (!text) { closeSelectionMenu(); return }
          var range = selection.getRangeAt(0).cloneRange()
          var rect = range.getBoundingClientRect()
          pendingSelection = { text:text.slice(0,6000), range:range, rect:rect }
          selectionMenu.style.left = Math.max(8, Math.min(window.innerWidth - 380, rect.left + 8)) + 'px'
          selectionMenu.style.top = Math.max(8, rect.top - 42) + 'px'
          selectionMenu.style.display = 'flex'
        }
        function onMouseUp(event) { if (!selectionMenu.contains(event.target)) setTimeout(inspectSelection, 0) }
        function onScroll() { closeSelectionMenu(); renderMarkers() }
        function onClickCapture(event) {
          var card = event.target && event.target.closest ? event.target.closest('[data-composer-card]') : null
          var button = event.target && event.target.closest ? event.target.closest('button') : null
          if (!card || !button || button.getAttribute('aria-haspopup')) return
          var buttons = Array.from(card.querySelectorAll('button'))
          if (buttons[buttons.length - 1] !== button) return
          if (injectBeforeSubmit()) { event.preventDefault(); event.stopPropagation() }
        }
        function onKeyCapture(event) {
          if (event.key !== 'Enter' || event.shiftKey || event.isComposing || !event.target || !event.target.closest || !event.target.closest('[data-composer-card] textarea')) return
          if (injectBeforeSubmit()) { event.preventDefault(); event.stopPropagation() }
        }
        document.addEventListener('mouseup', onMouseUp)
        document.addEventListener('scroll', onScroll, true)
        document.addEventListener('click', onClickCapture, true)
        document.addEventListener('keydown', onKeyCapture, true)
        return function() {
          document.removeEventListener('mouseup', onMouseUp)
          document.removeEventListener('scroll', onScroll, true)
          document.removeEventListener('click', onClickCapture, true)
          document.removeEventListener('keydown', onKeyCapture, true)
          closeEditor(); closeSelectionMenu()
          if (selectionMenu) selectionMenu.remove()
          selectionMenu = null
          markers.forEach(function(map) { map.forEach(function(marker) { marker.remove() }) })
          markers.clear()
        }
      }, 'dsh-plugin-text-quote-interactions-v2')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
