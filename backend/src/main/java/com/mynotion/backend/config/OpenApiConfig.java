package com.mynotion.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI myNotionOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("myNotion API")
                        .description("myNotion 編輯器後端 REST API 文件")
                        .version("v0.0.1"));
    }
}
