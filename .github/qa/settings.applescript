-- QA helper for qa-gatekeeper-proof.yml, run with osascript.
--   find     prints "found x y w h" (screen points) for System Settings' "Open Anyway" button, or "notfound"
--   scroll   the same, after asking macOS to scroll the button into view (AXScrollToVisible)
--   texts    every static text in System Settings' window that mentions Unvibe, one per line
--   grow     moves the window to the top left and makes it as tall as the screen allows
on run argv
	set mode to "find"
	if (count of argv) > 0 then set mode to item 1 of argv
	tell application "System Settings" to activate
	delay 0.5
	tell application "System Events"
		tell process "System Settings"
			if mode is "grow" then
				try
					set position of window 1 to {120, 40}
					set {w, h} to size of window 1
					set size of window 1 to {w, 1000}
				end try
				return "size " & ((item 1 of (size of window 1)) as integer) & " " & ((item 2 of (size of window 1)) as integer)
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
					else if r is "AXButton" then
						set n to ""
						try
							set n to name of e as text
						end try
						set d to ""
						try
							set d to description of e as text
						end try
						if n is "Open Anyway" or d is "Open Anyway" then
							if mode is "scroll" then
								try
									perform action "AXScrollToVisible" of e
								end try
								delay 0.8
							end if
							set p to position of e
							set s to size of e
							return "found " & ((item 1 of p) as integer) & " " & ((item 2 of p) as integer) & " " & ((item 1 of s) as integer) & " " & ((item 2 of s) as integer)
						end if
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
