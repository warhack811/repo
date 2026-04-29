import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '../../src/styles/index.css';
import { AppNav } from '../../src/components/app/AppNav.js';
import { ChatLayout } from '../../src/components/chat/ChatLayout.js';
import { ConversationSidebar } from '../../src/components/chat/ConversationSidebar.js';
import { RunaModal, RunaSheet } from '../../src/components/ui/index.js';
import type { ConversationSummary } from '../../src/hooks/useConversations.js';

const conversations: readonly ConversationSummary[] = [
	{
		access_role: 'owner',
		conversation_id: 'conv_mobile',
		created_at: '2026-04-29T00:00:00.000Z',
		last_message_at: '2026-04-29T00:00:00.000Z',
		last_message_preview: 'Responsive fixture conversation',
		title: 'Responsive QA',
		updated_at: '2026-04-29T00:00:00.000Z',
	},
];

function Fixture(): JSX.Element {
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(true);
	const [isSheetOpen, setIsSheetOpen] = useState(true);

	return (
		<MemoryRouter initialEntries={['/chat']}>
			<main className="runa-page runa-page--chat-product">
				<div className="runa-shell-frame runa-shell-frame--chat">
					<AppNav activePage="chat" />
					<button
						className="runa-button runa-button--secondary"
						onClick={() => setIsSidebarOpen(true)}
						type="button"
					>
						Open history
					</button>
					<ChatLayout
						composer={
							<section className="runa-card runa-card--strong" data-testid="composer">
								<label>
									Mesaj
									<textarea
										className="runa-input runa-input--textarea"
										defaultValue="Mobile composer"
									/>
								</label>
								<button className="runa-button runa-button--primary" type="button">
									Gonder
								</button>
							</section>
						}
						isSidebarOpen={isSidebarOpen}
						messages={
							<section className="runa-card runa-card--chat" data-testid="work-surface">
								<h1>Responsive chat surface</h1>
								<p className="runa-subtle-copy">
									Mobile-first layout, sticky composer and overlay sidebar fixture.
								</p>
							</section>
						}
						onCloseSidebar={() => setIsSidebarOpen(false)}
						onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
						sidebar={
							<ConversationSidebar
								activeConversationId="conv_mobile"
								activeConversationMembers={[]}
								activeConversationSummary={conversations[0] ?? null}
								conversationError={null}
								conversations={conversations}
								isLoading={false}
								isMemberLoading={false}
								isOpen={isSidebarOpen}
								memberError={null}
								onClose={() => setIsSidebarOpen(false)}
								onRemoveMember={async () => undefined}
								onSelectConversation={() => undefined}
								onShareMember={async () => undefined}
								onStartNewConversation={() => undefined}
							/>
						}
					/>
				</div>
				<RunaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Modal fixture">
					<div data-testid="modal-content">Responsive modal content</div>
				</RunaModal>
				<RunaSheet
					isOpen={isSheetOpen}
					onClose={() => setIsSheetOpen(false)}
					side="bottom"
					title="Sheet fixture"
				>
					<div data-testid="sheet-content">Responsive sheet content</div>
				</RunaSheet>
			</main>
		</MemoryRouter>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
