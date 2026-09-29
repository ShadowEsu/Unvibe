# Voice

Off by default. Enable under Companion → Settings → Learning → Voice questions.

Hold Hold to ask in the explanation widget. Recording state is visible. Releasing the button stops capture. There is no background recording.

Desktop uses Chromium `webkitSpeechRecognition` when present. That system service may send audio off-device. Cloud Deepgram and local transcription providers are interfaced but not wired.

If speech is unavailable, the widget says so instead of faking a transcript.
