"""The training script's chat-template helpers (the training itself needs a GPU and does not run here)."""

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("train_qlora", ROOT / "finetune" / "train_qlora.py")
train = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(train)


class Template:
    """Renders chats the way a model's chat template does."""

    def __init__(self, bos, user, model, end):
        self.bos_token, self._user, self._model, self._end = bos, user, model, end

    def apply_chat_template(self, messages, tokenize=False, add_generation_prompt=False):
        text = self.bos_token or ""
        for m in messages:
            text += (self._user if m["role"] == "user" else self._model) + m["content"] + self._end
        return text + (self._model if add_generation_prompt else "")


GEMMA4 = Template("<bos>", "<|turn>user\n", "<|turn>model\n", "<turn|>\n")
QWEN = Template(None, "<|im_start|>user\n", "<|im_start|>assistant\n", "<|im_end|>\n")


def test_turn_markers_come_from_the_base_model_template():
    assert train.turn_markers(GEMMA4) == ("<|turn>user\n", "<|turn>model\n")
    assert train.turn_markers(QWEN) == ("<|im_start|>user\n", "<|im_start|>assistant\n")


def test_rendered_examples_leave_the_bos_token_to_the_trainer():
    text = GEMMA4.apply_chat_template([{"role": "user", "content": "x"}, {"role": "assistant", "content": "{}"}])
    assert train.without_bos(text, train.bos_token(GEMMA4)) == "<|turn>user\nx<turn|>\n<|turn>model\n{}<turn|>\n"
    assert train.without_bos("<|im_start|>user\nx", train.bos_token(QWEN)) == "<|im_start|>user\nx"


def test_processors_expose_the_bos_token_of_their_tokenizer():
    class Processor:  # multimodal models wrap the tokenizer
        tokenizer = GEMMA4

    assert train.bos_token(Processor()) == "<bos>"


def test_trl_argument_names_follow_the_installed_version():
    def new_trl(self, model=None, processing_class=None, max_length=1024):
        pass

    def old_trl(self, model=None, tokenizer=None, max_seq_length=1024):
        pass

    assert train.supported_name(new_trl, "max_length", "max_seq_length") == "max_length"
    assert train.supported_name(old_trl, "max_length", "max_seq_length") == "max_seq_length"
    assert train.supported_name(new_trl, "processing_class", "tokenizer") == "processing_class"
    assert train.supported_name(old_trl, "processing_class", "tokenizer") == "tokenizer"
