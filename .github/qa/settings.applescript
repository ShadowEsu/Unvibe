-- QA helper for qa-gatekeeper-proof.yml, run with osascript.
--   grow     moves System Settings' window to the top left and makes it as tall as the screen allows
--   anchor   scrolls the blocked-app message (static text naming Unvibe) into view; prints "found x y w h" or "notfound"
--   find     prints "found x y w h" for the "Open Anyway" control (name, title or description), or "notfound"
--   press    clicks that control; prints "pressed" or "notfound"
--   texts    every static text in the window that mentions Unvibe, one per line
on matchesOpenAnyway(e)
	tell application "System Events"
		repeat with k in {"name", "title", "description"}
			try
				if (k as text) is "name" then set v to name of e as text
				if (k as text) is "title" then set v to value of attribute "AXTitle" of e as text
				if (k as text) is "description" then set v to description of e as text
				if v contains "Open Anyway" then return true
			end try
		end repeat
	end tell
	return false
end matchesOpenAnyway

on run argv
	set mode to "find"
	if (count of argv) > 0 then set mode to item 1 of argv
	tell application "System Settings" to activate
	delay 0.5
	tell application "System Events"
		tell process "System Settings"
			if mode is "grow" then
				try
					set position of window 1 to {120, 30}
					set s to size of window 1
					set size of window 1 to {item 1 of s, 720}
				end try
				set s to size of window 1
				return "size " & ((item 1 of s) as integer) & " " & ((item 2 of s) as integer)
			end if
			set els to entire contents of window 1
			set found to {}
			repeat with e in els
				try
					set r to role of e
					if mode is "texts" then
						if r is "AXStaticText" then
							set v to value of e as text
							if v contains "Unvibe" then set end of found to v
						end if
					else if mode is "anchor" then
						if r is "AXStaticText" then
							set v to value of e as text
							if v contains "Unvibe" then
								try
									perform action "AXScrollToVisible" of e
								end try
								delay 0.8
								set p to position of e
								set s to size of e
								return "found " & ((item 1 of p) as integer) & " " & ((item 2 of p) as integer) & " " & ((item 1 of s) as integer) & " " & ((item 2 of s) as integer)
							end if
						end if
					else if r is not "AXStaticText" and my matchesOpenAnyway(e) then
						if mode is "press" then
							try
								perform action "AXPress" of e
							on error
								click e
							end try
							return "pressed " & r
						end if
						set p to position of e
						set s to size of e
						return "found " & ((item 1 of p) as integer) & " " & ((item 2 of p) as integer) & " " & ((item 1 of s) as integer) & " " & ((item 2 of s) as integer) & " " & r
					end if
				end try
			end repeat
			if mode is "texts" then
				set AppleScript's text item delimiters to linefeed
				return found as text
			end if
		end tell
	end tell
	return "notfound"
end run
