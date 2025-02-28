import * as React from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
    scrollRef: React.MutableRefObject<HTMLDivElement | null>;
    isAtBottom: boolean;
    scrollToBottom: () => void;
    disableAutoScroll: () => void;
    smooth?: boolean;
}

const ChatMessageList = React.forwardRef<HTMLDivElement, ChatMessageListProps>(
    ({ className, children, scrollRef, isAtBottom, scrollToBottom, disableAutoScroll, ...props }, ref) => {
        return (
            <div className="relative w-full h-full">
                <div
                    className={cn("flex flex-col w-full h-full p-4 overflow-y-auto", className)}
                    ref={(node) => {
                        if (node) {
                            // Only assign if node is not null
                            if (typeof ref === 'function') {
                                ref(node);
                            } else if (ref) {
                                ref.current = node;
                            }
                            if (scrollRef) {
                                scrollRef.current = node;
                            }
                        } else {
                            // Handle null case
                            if (typeof ref === 'function') {
                                ref(null);
                            } else if (ref) {
                                ref.current = null;
                            }
                            if (scrollRef) {
                                scrollRef.current = null;
                            }
                        }
                    }}
                    onWheel={disableAutoScroll}
                    onTouchMove={disableAutoScroll}
                    {...props}
                >
                    <div className="flex flex-col gap-6">{children}</div>
                </div>

                {!isAtBottom && (
                    <Button
                        onClick={scrollToBottom}
                        size="icon"
                        variant="outline"
                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 inline-flex rounded-full shadow-md"
                    >
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                )}
            </div>
        );
    }
);

ChatMessageList.displayName = "ChatMessageList";

export { ChatMessageList };
