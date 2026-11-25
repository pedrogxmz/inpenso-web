//
//  FoundationModelsWebBridge.swift
//  Inpenso
//
//  Puente nativo para conectar la app React Web (dentro de un WKWebView o Capacitor .ipa)
//  con el modelo en chip de Apple Intelligence (FoundationModels / SystemLanguageModel.default).
//

import Foundation
import WebKit
#if canImport(FoundationModels)
import FoundationModels
#endif

@MainActor
final class FoundationModelsWebBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    /// Registra este handler en tu WKWebViewConfiguration:
    /// `config.userContentController.add(bridge, name: "foundationModels")`
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "foundationModels",
              let body = message.body as? [String: Any],
              let id = body["id"] as? String,
              let prompt = body["prompt"] as? String,
              let context = body["context"] as? String else {
            return
        }

        Task {
            await handlePrompt(id: id, prompt: prompt, context: context)
        }
    }

    private func handlePrompt(id: String, prompt: String, context: String) async {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            do {
                let instructions = """
                You are Inpenso's personal finance assistant running on-device via Apple Intelligence.
                Answer in the same language as the user (Spanish by default), concisely and accurately,
                using the user's real financial context below:
                \(context)
                """
                let session = LanguageModelSession(instructions: instructions)
                let response = try await session.respond(to: prompt)
                sendToWeb(id: id, text: response.content, done: true, error: nil)
                return
            } catch {
                sendToWeb(id: id, text: "", done: true, error: error.localizedDescription)
                return
            }
        }
        #endif
        sendToWeb(id: id, text: "", done: true, error: "Apple Intelligence requires iOS 26.0+")
    }

    private func sendToWeb(id: String, text: String, done: booleanType, error: String?) {
        let payload: [String: Any?] = ["id": id, "text": text, "done": done, "error": error]
        guard let data = try? JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 }),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = """
        (function() {
            const p = \(json);
            window.InpensoNative?.onResponse?.(p.id, p.text || "", Boolean(p.done), p.error);
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
private typealias booleanType = Bool
