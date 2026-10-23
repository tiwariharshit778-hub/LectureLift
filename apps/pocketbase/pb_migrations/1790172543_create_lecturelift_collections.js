/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');

		const ownerRules = {
			listRule: "@request.auth.id != '' && @request.auth.id = user",
			viewRule: "@request.auth.id != '' && @request.auth.id = user",
			createRule: "@request.auth.id != '' && @request.auth.id = user",
			updateRule: "@request.auth.id != '' && @request.auth.id = user",
			deleteRule: "@request.auth.id != '' && @request.auth.id = user",
		};

		const userField = () => ({
			name: 'user',
			type: 'relation',
			required: true,
			maxSelect: 1,
			collectionId: users.id,
			cascadeDelete: true,
		});

		const lectureField = (lecturesId) => ({
			name: 'lecture',
			type: 'relation',
			required: true,
			maxSelect: 1,
			collectionId: lecturesId,
			cascadeDelete: true,
		});

		const timestamps = [
			{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
			{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
		];

		const lectures = new Collection({
			type: 'base',
			name: 'lectures',
			...ownerRules,
			fields: [
				userField(),
				{ name: 'title', type: 'text', required: true, max: 200 },
				{ name: 'subject', type: 'text', max: 120 },
				{ name: 'description', type: 'text', max: 2000 },
				{
					name: 'file',
					type: 'file',
					required: true,
					maxSelect: 1,
					maxSize: 104857600,
					mimeTypes: ['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'],
				},
				{ name: 'file_type', type: 'select', values: ['audio', 'video'], maxSelect: 1 },
				{
					name: 'status',
					type: 'select',
					values: ['pending', 'transcribing', 'generating', 'ready', 'failed'],
					maxSelect: 1,
				},
				{ name: 'error_message', type: 'text', max: 2000 },
				{ name: 'duration_seconds', type: 'number', min: 0 },
				...timestamps,
			],
		});
		app.save(lectures);

		const transcripts = new Collection({
			type: 'base',
			name: 'transcripts',
			...ownerRules,
			fields: [
				lectureField(lectures.id),
				userField(),
				{ name: 'content', type: 'text', required: true },
				{ name: 'segments', type: 'json' },
				...timestamps,
			],
		});
		app.save(transcripts);

		const notes = new Collection({
			type: 'base',
			name: 'notes',
			...ownerRules,
			fields: [lectureField(lectures.id), userField(), { name: 'content', type: 'json', required: true }, ...timestamps],
		});
		app.save(notes);

		const flashcards = new Collection({
			type: 'base',
			name: 'flashcards',
			...ownerRules,
			fields: [
				lectureField(lectures.id),
				userField(),
				{ name: 'question', type: 'text', required: true },
				{ name: 'answer', type: 'text', required: true },
				{ name: 'review_state', type: 'select', values: ['new', 'known', 'unknown'], maxSelect: 1 },
				{ name: 'last_reviewed_at', type: 'date' },
				{ name: 'next_review_at', type: 'date' },
				...timestamps,
			],
		});
		app.save(flashcards);

		const quizQuestions = new Collection({
			type: 'base',
			name: 'quiz_questions',
			...ownerRules,
			fields: [
				lectureField(lectures.id),
				userField(),
				{ name: 'question', type: 'text', required: true },
				{ name: 'options', type: 'json', required: true },
				{ name: 'correct_index', type: 'number', required: true, min: 0, max: 3 },
				{ name: 'explanation', type: 'text' },
				...timestamps,
			],
		});
		app.save(quizQuestions);

		const quizAttempts = new Collection({
			type: 'base',
			name: 'quiz_attempts',
			...ownerRules,
			fields: [
				lectureField(lectures.id),
				userField(),
				{ name: 'score', type: 'number', min: 0 },
				{ name: 'total', type: 'number', min: 0 },
				...timestamps,
			],
		});
		app.save(quizAttempts);

		const mindMaps = new Collection({
			type: 'base',
			name: 'mind_maps',
			...ownerRules,
			fields: [
				lectureField(lectures.id),
				userField(),
				{ name: 'structure', type: 'json', required: true },
				...timestamps,
			],
		});
		app.save(mindMaps);
	},
	(app) => {
		for (const name of ['mind_maps', 'quiz_attempts', 'quiz_questions', 'flashcards', 'notes', 'transcripts', 'lectures']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch (_) {}
		}
	},
);
