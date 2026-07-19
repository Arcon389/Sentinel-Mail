from app.services.template_engine import build_body, build_headers, render_template

CONTEXT = {"account_name": "Postfach A", "unread_count": 3, "subject": "Hi", "sender": "x@example.com"}


def test_known_placeholder_is_substituted():
    assert render_template("Konto {account_name} hat {unread_count}", CONTEXT) == "Konto Postfach A hat 3"


def test_unknown_named_placeholder_renders_empty():
    assert render_template("[{does_not_exist}]", CONTEXT) == "[]"


def test_empty_positional_braces_are_left_literal():
    # Regression: "{}" used to raise ValueError("Format string contains positional fields").
    assert render_template("{}", CONTEXT) == "{}"


def test_numeric_positional_token_does_not_raise():
    assert render_template("{0}", CONTEXT) == ""


def test_literal_json_braces_survive_with_inner_placeholder():
    out = render_template('{"count": {unread_count}}', CONTEXT)
    assert out == '{"count": 3}'


def test_empty_body_template_renders_literal_empty_object():
    # A webhook with only a URL sends body_type=json_raw, body_template="".
    body, content_type = build_body({"body_type": "json_raw", "body_template": ""}, CONTEXT)
    assert body == b"{}"
    assert content_type == "application/json"


def test_none_body_template_renders_literal_empty_object():
    body, _ = build_body({"body_type": "json_raw", "body_template": None}, CONTEXT)
    assert body == b"{}"


def test_json_raw_body_with_placeholder():
    body, _ = build_body({"body_type": "json_raw", "body_template": '{"n": {unread_count}}'}, CONTEXT)
    assert body == b'{"n": 3}'


def test_build_headers_renders_both_sides():
    headers = build_headers([{"key": "X-Account", "value": "{account_name}"}], CONTEXT)
    assert headers == {"X-Account": "Postfach A"}
